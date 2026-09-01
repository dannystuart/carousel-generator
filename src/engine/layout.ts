import { DEG, arcRadius, cardVisual } from "./geometry";
import type { CarouselParams, RingSpec } from "./types";

/** Never render more than this many cards either side, whatever the parameters say. */
const HARD_CAP = 30;

/** Below this fraction of full size a card is a speck and not worth a node. */
const MIN_USEFUL_SCALE = 0.04;

/**
 * How far card `index` sits from the focused position, in card units.
 *
 * When looping, this is the *shortest signed* distance: with the position on
 * card 11 of 12, card 0 is one step ahead rather than eleven steps behind, so
 * it slides in from the near side instead of travelling the long way round.
 * The position is a float mid-tween, and the result stays continuous as it
 * walks across the seam.
 */
export function wrappedOffset(index: number, position: number, count: number, loop: boolean): number {
  const raw = index - position;
  if (!loop || count <= 0) return raw;
  const half = count / 2;
  // JS % keeps the sign of the dividend, so normalise into [0, count) first.
  const forward = ((raw % count) + count) % count;
  return forward > half ? forward - count : forward;
}

/**
 * How many cards either side of the focused one are worth rendering.
 *
 * A closed ring needs all of them — the far side curves back into view, so
 * there is no off-screen to cull to. A straight track marches away forever, so
 * the window is bounded by whichever runs out first: the fade, the size
 * falloff, half a ring's worth of wrapping, or the hard cap.
 */
export function visibleRange(p: CarouselParams, count: number): number {
  let limit = HARD_CAP;

  // opacity = 1 − fadeFalloff·n, so it reaches zero at n = 1/fadeFalloff.
  if (p.fadeFalloff > 0) limit = Math.min(limit, Math.floor(1 / p.fadeFalloff));

  // scale = 1/(1 + sizeFalloff·n), so it drops under MIN_USEFUL_SCALE at
  // n = (1/MIN_USEFUL_SCALE − 1) / sizeFalloff.
  if (p.sizeFalloff > 0) {
    limit = Math.min(limit, Math.ceil((1 / MIN_USEFUL_SCALE - 1) / p.sizeFalloff));
  }

  // wrappedOffset never returns more than half a ring, so anything beyond that
  // is a card that is already being drawn on the other side.
  limit = Math.min(limit, p.loop ? Math.ceil(count / 2) : count);

  return Math.max(1, limit);
}

const SINGLE_RING: RingSpec = { scale: 1, drift: 0 };

/** Cards per row. Two rows split the set, so each row's ring still closes. */
export function cardsPerRow(p: CarouselParams, count: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.round(p.bandRows))));
}

/** Daylight between one ring and the next, as a multiple of the card's width. */
const RING_GAP_CARDS = 1.3;

/**
 * How much wider ring `index` should sit than the base ring.
 *
 * A ring's size is a multiple of the arrangement's *own* radius, and that radius
 * is not a property of how the style looks — it is spacing over the angular step,
 * so a barely-curved arrangement is a shallow slice of an enormous circle.
 * Coverflow's is three thousand pixels across. A fixed multiplier therefore means
 * something completely different on every style: 1.7x is a gentle step out on a
 * closed ring and two thousand pixels through the camera on a coverflow, where it
 * showed up as one card blown up to four times the width of the frame.
 *
 * So the multiplier is worked back from the gap it is meant to leave — a card's
 * width and a bit of daylight — against whatever it is that actually separates
 * the rings: the radius where there is one, the spacing where the track is flat
 * and each ring is a wider-spread copy of the last. Only used for a ring the
 * visitor adds; the twelve styles carry their own numbers, tuned by eye.
 *
 * Depth is in there because it stretches that gap into the screen without
 * touching it across the screen — so the rings on a deep style are further apart
 * than their radii suggest, and the one that decides how much bigger the outer
 * ring's cards come out is the deeper of the two. Peek stack, at triple depth, is
 * the style that shows it.
 */
export function defaultRingScale(p: CarouselParams, index: number, count: number): number {
  if (index <= 0) return 1;
  const radius = arcRadius(p.curve, p.spacing, count);
  const apart = (radius > 0 ? radius : p.spacing) * Math.max(1, p.depth);
  if (!(apart > 0)) return 1;
  const scale = 1 + (index * p.cardWidth * RING_GAP_CARDS) / apart;
  // The slider's own range, so what is handed back is a value it can show.
  return Math.min(3, Math.max(0.4, Math.round(scale * 20) / 20));
}

/**
 * How far to slide the whole arrangement within its own space so it sits in the
 * middle of the box rather than hanging off one edge.
 *
 * The arc puts the focused card at the origin, which is exactly right for a
 * coverflow — the focused card belongs dead centre. But bend the arc up the
 * screen and a closed ring now spans two radii *upward* from that origin, so at
 * any useful radius the top half is off-screen; the same goes for a two-row band
 * hanging below its first row, and for a helix climbing out of frame.
 *
 * So: measure what the arrangement actually spans in y and offset by half of it.
 * A flat track and a bowl both come out at zero, so coverflow is untouched.
 * Measured from the resting shape rather than live positions, so it does not
 * drift about while the carousel is moving.
 */
export interface ArrangementCentre {
  /** Slide the arrangement by this much in y so it sits in the middle of the box. */
  y: number;
  /**
   * Depth of the arrangement's middle. Used as the pitch's pivot rather than as
   * a shift: a bowl recedes away from the focused card, so rotating about the
   * origin swings its near edge down out of frame and its far edge up. Pivoting
   * about the middle is what tips a ring over on the spot. At pitch 0 it has no
   * effect at all, so a coverflow is untouched.
   */
  z: number;
}

export function arrangementCentre(p: CarouselParams, count: number, range: number): ArrangementCentre {
  if (count <= 0) return { y: 0, z: 0 };

  // Jitter would make the composition depend on the dice.
  const steady = p.jitter > 0 ? { ...p, jitter: 0 } : p;
  const rings = p.rings.length > 0 ? p.rings : [SINGLE_RING];
  const rows = Math.max(1, Math.round(p.bandRows));

  // Never sample further round than a card can actually get. Seven looping cards
  // reach 3.5 steps from the focused one; measuring the arc out to the window's
  // full width would credit the arrangement with height that has no card in it,
  // and lift the whole thing out of the middle of the frame.
  // Cards rest on whole offsets, so this is a whole number too: seven looping
  // cards occupy -3 to 3, not -3.5 to 3.5.
  const reach = Math.floor(Math.min(range, p.loop ? count / 2 : count - 1));

  // The stage applies translateY *before* its rotations, so the slide is in plain
  // screen pixels and works at any camera angle — including a track rolled fully
  // vertical, where a slide inside the rotations would have moved it sideways.
  const pitch = p.pitch * DEG;
  const tilt = p.tilt * DEG;

  const points: { x: number; y: number; z: number }[] = [];
  let nearestZ = -Infinity;
  let furthestZ = Infinity;

  for (const ring of rings) {
    for (let row = 0; row < rows; row++) {
      for (let offset = -reach; offset <= reach; offset += 1) {
        // Without the paint-order sliver: this measures where the arrangement
        // sits, and a hint about which card draws over which is not part of that.
        const point = cardVisual(steady, offset, 0, count, ring.scale, row, undefined, false);
        points.push(point);
        if (point.z > nearestZ) nearestZ = point.z;
        if (point.z < furthestZ) furthestZ = point.z;
      }
    }
  }

  if (points.length === 0) return { y: 0, z: 0 };
  const pivot = (nearestZ + furthestZ) / 2;

  // Where each card lands on screen, all the way through: rolled by tilt, pitched
  // about the arrangement's mid-depth, then divided by the camera.
  //
  // That last step is the one it is tempting to leave out, and it is the one that
  // matters most here. Pitch is what turns depth into screen height, and depth is
  // exactly what the divide compresses — so a ring measured before the divide is
  // credited with a far half that reaches higher than it ever paints, and the
  // whole thing gets slid up to compensate. That is a helix hanging 200px above
  // its box.
  //
  // Screen height is (y₂ + slide)·k, with k the card's own perspective factor —
  // linear in the slide, and every k positive, so the midpoint of the extremes
  // only ever rises with it and a few Newton steps land on the root exactly.
  const distance = Math.max(1, p.distance);
  const projected = points.map(({ x, y, z }) => {
    const rolled = x * Math.sin(tilt) + y * Math.cos(tilt);
    const depth = z - pivot;
    return {
      height: rolled * Math.cos(pitch) - depth * Math.sin(pitch),
      // Matching cardVisual's own camera clamp, so a card that has been stopped
      // short of the eye is measured where it is actually drawn.
      k: distance / Math.max(distance * 0.18, distance - (rolled * Math.sin(pitch) + depth * Math.cos(pitch) + pivot)),
    };
  });

  let slide = 0;
  for (let step = 0; step < 24; step += 1) {
    let lowest = Infinity;
    let highest = -Infinity;
    let kLowest = 1;
    let kHighest = 1;
    for (const { height, k } of projected) {
      const screen = (height + slide) * k;
      if (screen < lowest) { lowest = screen; kLowest = k; }
      if (screen > highest) { highest = screen; kHighest = k; }
    }
    const residual = (lowest + highest) / 2;
    if (!Number.isFinite(residual)) return { y: 0, z: pivot };
    if (Math.abs(residual) < 1e-7) break;
    slide -= (2 * residual) / (kLowest + kHighest);
  }

  return { y: Number.isFinite(slide) ? slide : 0, z: pivot };
}
