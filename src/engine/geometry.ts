import type { CarouselParams, CardVisual } from "./types";

const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Below this the small-angle limit is used instead of dividing by stepAngle. */
const FLAT_EPSILON = 1e-6;

export function stepAngle(curve: number, count: number): number {
  return curve * (TAU / Math.max(count, 3));
}

/** The arc's radius, or 0 where it has straightened out into a line. */
export function arcRadius(curve: number, spacing: number, count: number): number {
  const step = stepAngle(curve, count);
  return step < FLAT_EPSILON ? 0 : spacing / step;
}

/**
 * A point on the arc, in the arrangement's own space, with the focused card at the origin.
 * Radius is spacing / stepAngle, which keeps the gap between cards constant as the
 * curve opens out, and closes the ring exactly at curve = 1.
 */
export function arcPoint(a: { offset: number; curve: number; spacing: number; count: number }) {
  const step = stepAngle(a.curve, a.count);
  if (step < FLAT_EPSILON) {
    return { x: a.offset * a.spacing, z: 0, phi: 0 };
  }
  const radius = a.spacing / step;
  const phi = a.offset * step;
  return { x: radius * Math.sin(phi), z: radius * (Math.cos(phi) - 1), phi };
}

/** Deterministic per-card noise. Never Math.random — the exported code must match the preview. */
function seeded(index: number, salt: number): number {
  let t = (index * 0x9e3779b9 + salt * 0x85ebca6b) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; // -1..1
}

/** Smooth ±1 clamp, so card angle saturates instead of spinning past 90° on far cards. */
const lean = (offset: number) => Math.tanh(offset * 0.9);

/** How many cards' worth of window the edge fade spans. */
const EDGE_FADE_CARDS = 1.25;

/**
 * How much of a card's width must still face the viewer before it fades, as
 * the sine of the angle left to edge-on. 0.25 is about the last fourteen
 * degrees of turn.
 *
 * A card turned past edge-on shows its back, and the back is hidden — so a
 * card that turns while you watch pops out of existence at the flip. On a
 * closed ring that pop sits at the ring's own edges, and morphing a marquee
 * into a flat style marched seven cards through it in the first hundred
 * milliseconds: dark slivers flickering in one after another exactly where
 * the cards join. The same idea as the render-window fade above, applied to
 * the angular edge: a card leaves through a fade, not through a pop.
 *
 * Narrow on purpose. It only touches cards within a sliver of edge-on —
 * already a few pixels wide on screen — so a coverflow's 54° lean, a fanned
 * arch (whose facing turns in the screen plane, not away from the viewer)
 * and every other resting style are exactly as tuned.
 */
const EDGE_ON_FADE = 0.25;

/** A card is never allowed closer to the eye than this fraction of the distance. */
const MAX_CAMERA_APPROACH = 0.82;

/**
 * The fraction of its own depth a fully upright arrangement keeps, purely so the
 * cards still have an order to be drawn in.
 *
 * At arcRotation 90 the bend stands up in the screen plane and cos(90°) is zero,
 * so every card's z is exactly zero and there is nothing left to sort by. The
 * browser falls back to document order at that point, which is a different stack
 * from the depth order it was using a frame earlier — so the whole arrangement
 * visibly re-shuffles on the last frame of a preset change, and from then on the
 * card coming into focus slides *behind* its neighbours instead of in front.
 * Keeping a sliver of the arc's own depth carries the right order through: on
 * the deepest ring that ships it is under two pixels, against a camera 1400px
 * away, so it decides the stacking and changes nothing you can see.
 *
 * It is weighted by how far the bend has stood up, so it is exactly nothing on a
 * bowl — a ring at arcRotation 0 is still a true circle of its own radius, to
 * the last decimal place — and only reaches full strength where the depth it
 * would have sorted by has gone.
 */
const FLAT_STACK = 0.004;

/**
 * Where the paint order counts from.
 *
 * The two engines resolve overlapping cards by different means, and neither
 * covers what the other does. Chromium sorts by depth inside `preserve-3d` — a
 * single pixel is enough — and ignores `z-index` there completely. Safari draws
 * an arrangement lying flat in the screen plane in document order however far
 * apart in depth its cards are, and takes `z-index` instead. So the engine
 * writes both, from this one number, and the two agree.
 *
 * The widest arrangement the sliders can reach is a closed ring of forty cards
 * 600px apart at triple depth, which is about ±23,000 either side of the
 * focused card; this leaves room for it without ever going negative.
 */
const Z_INDEX_ORIGIN = 30000;

export function cardVisual(
  p: CarouselParams,
  offset: number,
  index: number,
  count: number,
  ringScale = 1,
  row = 0,
  /** The render window, when the caller has one. Enables the edge fade. */
  range?: number,
  /**
   * Whether to include the paint-order sliver above. It belongs in what gets
   * drawn and nowhere else: `arrangementCentre` measures where a composition
   * sits in its box, and a hint about drawing order is not part of that. Left
   * in, it moves the framing by a couple of pixels when a second ring is added
   * — which would mean concentric rings no longer share a centre on paper.
   */
  stacked = true,
): CardVisual {
  // Scaling `spacing` scales the radius, and with it both x and z, so a ring at
  // ringScale 2 is a circle of twice the radius rather than an ellipse. The
  // angular step is untouched, so every ring still closes at curve 1.
  const { x: ax, z: az0, phi } = arcPoint({ offset, curve: p.curve, spacing: p.spacing * ringScale, count });

  // …and then slid back onto the base ring's centre, because "concentric" has to
  // mean one centre and several radii. Without this each ring merely touches the
  // others at the focused card, which is not what Dual Orbit shows. A flat track
  // has no centre to share, and arcRadius returns 0 there, so nothing moves.
  const concentric = az0 + arcRadius(p.curve, p.spacing, count) * (ringScale - 1);

  let az = concentric * p.depth;
  if (p.invert) az = -az;

  // arcRotation swings the bend from "into the screen" (0, a bowl) to "up the
  // screen" (90, an arch — focused card at the top, outer cards hanging below).
  const ar = p.arcRotation * DEG;
  const rise = p.risePerTurn * (phi / TAU);
  const rowOffset = row * p.cardWidth * p.cardAspect * 1.04;

  const x = ax;
  const y = -az * Math.sin(ar) + rise + rowOffset;
  // Past the eye, a card's perspective scale flips sign and it paints as
  // garbage. Depth saturates instead of sailing through the camera.
  const limit = p.distance * MAX_CAMERA_APPROACH;
  // arcRotation never leaves a quarter turn either way, so cos is never negative
  // here and the sliver can only ever preserve the arc's order, never invert it.
  const sliver = stacked ? FLAT_STACK * (1 - Math.cos(ar)) : 0;
  const z = Math.min(limit, az * (Math.cos(ar) + sliver));

  // Orientation. Card facing follows whichever way the arc actually bends: on a
  // bowl the cards yaw around the vertical axis, on an arch lying in the screen
  // plane they turn within it. Five of the twelve references are screen-plane
  // rings, so a single yaw term would have them all facing the wrong way.
  // Card angle is separate and always a yaw — "turned away from the viewer".
  const facingSign = p.invert ? -1 : 1;
  const facing = (p.cardFacing * (facingSign * phi)) / DEG;
  const rotY = facing * Math.cos(ar) - p.cardAngle * lean(offset);
  const rotX = 0; // cards stay upright unless the scene pitches them
  // The stage rolls the whole track by `tilt`, cards included. Cancelling that
  // roll per card leaves the path diagonal and the cards straight, which is the
  // iPhone 16 Pro look; leaving it gives Unveil's rolled cards.
  // A card following the circumference points its own top away from the circle's
  // centre, so its lean *is* its angle round the arc — the ordered fan the
  // Gather reference has. Rolling it the other way leaves every card leaning
  // into the centre instead, which reads as scattered rather than as a fan.
  // Card facing runs to -1 for exactly that look, deliberately.
  let rotZ = facing * Math.sin(ar) - p.tilt * p.cardUpright;

  // scale — asymptotic, so it is always positive however deep the stack goes
  const a = Math.abs(offset);
  let scale = 1 / (1 + p.sizeFalloff * a);
  scale *= 1 + p.sizeGradient * offset * 0.12;
  // Eclectic sizes: some cards markedly bigger than standard, some smaller, so
  // a flat fan reads as hand-laid rather than as a uniform strip.
  if (p.sizeJitter > 0) scale *= 1 + seeded(index, 4) * 0.55 * p.sizeJitter;
  scale = Math.max(0.02, scale);

  // GOTCHA: filter resolves in the element's own coordinate space, before the ancestor
  // transform. blur(8px) inside a scale(0.4) paints 3.2px. Divide so the slider means
  // screen pixels. See docs/web-build-gotchas.md, "filter: blur() inside a scaled ancestor".
  const blur = Math.min(40, (p.blurFalloff * a) / scale);

  let opacity = Math.max(0, Math.min(1, 1 - p.fadeFalloff * a));

  // The angular edge fade described above. Keyed on the card's own yaw: at
  // 90° the card lies along the viewing axis and is about to flip to its
  // hidden back, so it fades over the last stretch of turn either side of
  // that. |cos| makes the ramp symmetrical about the flip — a card fades out
  // on the way in to edge-on and back in on the way out, whichever direction
  // it is turning, and everywhere else the fade is exactly 1.
  opacity *= Math.min(1, Math.abs(Math.cos(rotY * DEG)) / EDGE_ON_FADE);

  // Cards at the edge of the render window fade out instead of popping. Skipped
  // where the arrangement genuinely closes on itself — on a plain ring, card
  // +half and card -half are the same card and there is no edge to hide.
  // Anything that makes those two cards differ breaks the loop and needs the
  // fade: a helix closes in plan but not in height, and a vortex closes in plan
  // but puts an enormous card next to a speck.
  //
  // "Closes" requires the curve actually shut — card +half and card -half only
  // share a place at curve 1. Decided on card count alone, a flat fan counted
  // as closed, and its two *ends* are half the strip apart: every travel
  // between cards flung the edge card from one end to the other, opaque, in
  // one frame — measured at 2,472px on screen.
  if (range !== undefined && range > 0) {
    const closes =
      p.curve >= 1 && range >= count / 2 && p.risePerTurn === 0 && p.sizeGradient === 0;
    if (!closes) {
      opacity *= Math.max(0, Math.min(1, (range - a) / EDGE_FADE_CARDS));
    }
  }

  let jx = 0;
  let jy = 0;
  if (p.jitter > 0) {
    jx = seeded(index, 1) * 18 * p.jitter;
    jy = seeded(index, 2) * 18 * p.jitter;
    rotZ += seeded(index, 3) * 7 * p.jitter;
  }

  return {
    x: x + jx,
    y: y + jy,
    z,
    rotX,
    rotY,
    rotZ,
    scale,
    blur,
    opacity,
    // Keyed on the arc's own depth rather than on the drawn z. The drawn z is
    // that depth times a factor that is never negative, so the two rank the
    // cards identically — and this one still has a pixel of resolution where the
    // drawn depth has been squeezed down to the sliver above. Offset to keep it
    // positive, since a ring reaching toward the viewer makes it negative.
    //
    // …and then broken by how near the card is to the focused one, because on a
    // flat track every card's depth is exactly zero and the tie was going to
    // whichever came later in the markup. That put a half-faded neighbour over
    // the focused card on Flat fan and Diagonal descent, and you could see the
    // front card through it. Nearest-to-centre wins, which is how a fan stacks
    // anyway. Depth is multiplied out first so it always outranks the tiebreak:
    // one pixel of real depth is 32 apart, and the tiebreak spans 31.
    zIndex: Math.round((Z_INDEX_ORIGIN + az) * 32) - Math.min(31, Math.round(Math.abs(offset))),
  };
}
