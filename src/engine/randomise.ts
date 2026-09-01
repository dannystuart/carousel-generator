import { PARAM_META } from "./defaults";
import { cautionReason } from "./inert";
import type { CarouselParams, Easing } from "./types";

/**
 * NOT WIRED UP. The "Surprise me" button was removed on 12 Aug 2026, because
 * what this produced was usually busy, often ugly and sometimes visibly slow.
 * Kept, with what was measured, because the *idea* is right — the styles between
 * the twelve are worth finding — and the next attempt should not start by
 * rediscovering why this one failed.
 *
 * **It is not the card count.** The obvious suspect turned out to be innocent:
 * 500 rolls painted 7–40 cards against the shipped styles' 7–24, median 20
 * against 18. Near enough the same.
 *
 * **It is the blur.** `filter: blur()` is a separate offscreen pass per card,
 * costing radius times the area behind it, and `blurFalloff` is sampled here
 * uniformly across 0–5px per step. Nine of the twelve shipped styles use no blur
 * at all, and the heaviest — Depth tunnel — blurs 0.7 megapixels. Of 500 rolls,
 * 46% were heavier than that and 7% were more than three times it, the worst
 * reaching 5.9 megapixels: eight times the heaviest thing that ships.
 *
 * **And the busyness is structural, not a matter of narrowing a range.** Twenty
 * three parameters are drawn independently and uniformly here. The twelve styles
 * are not scattered through that space, they are twelve tightly correlated
 * points in it — a hard curve wants a low card angle, real depth wants a close
 * camera, heavy blur wants a fade to hide behind. Sampling each dial on its own
 * lands between all of them essentially every time. No amount of tightening the
 * ranges fixes that, because the problem is the independence, not the widths.
 *
 * So a working version would not roll dials at all. It would start from a style
 * that is known to work and perturb it — pick one of the twelve, move a handful
 * of parameters by a bounded amount, leave the rest — which keeps the
 * correlations that make a style a style, and turns the button into "somewhere
 * near here, but not this" rather than "anywhere at all". That is a different
 * function from this one, and it is why this is left dormant rather than tuned.
 */

/**
 * Where the dice may land.
 *
 * Narrower than the sliders on purpose. A slider's range is everything the
 * engine will accept, including the ends nobody wants; these are the parts of
 * each range that produce a carousel rather than a mistake.
 *
 * Anything not listed here is left alone. Speed, because a random one makes
 * every roll feel wrong for a reason nobody can place. Card content, because a
 * caption appearing unasked is not a look. And everything under "what visitors
 * can do", because whether a site has arrows or loops is a decision somebody
 * made about their site, and rolling dice on it would throw that away.
 */
export const RANDOM_RANGES: Partial<Record<keyof CarouselParams, [number, number]>> = {
  curve: [0, 1],
  cardAngle: [0, 70],
  depth: [0.4, 2.2],
  spacing: [120, 420],
  sizeFalloff: [0, 0.55],
  pitch: [-45, 45],
  distance: [700, 3000],
  zoom: [0.7, 1.5],
  tilt: [-40, 40],
  arcRotation: [-90, 90],
  risePerTurn: [-300, 300],
  blurFalloff: [0, 5],
  fadeFalloff: [0, 0.3],
  sizeGradient: [-0.7, 0.7],
  cardFacing: [-1, 1],
  jitter: [0, 0.5],
  sizeJitter: [0, 0.6],
  cardUpright: [0, 1],
  cardWidth: [180, 420],
  cardAspect: [0.7, 1.7],
  cardRadius: [0, 32],
  transparency: [0, 0.4],
};

const EASINGS: Easing[] = ["settle", "snap", "glide", "overshoot"];

function pick(key: keyof CarouselParams, random: () => number): number {
  const meta = PARAM_META[key];
  const [lo, hi] = RANDOM_RANGES[key]!;
  const step = meta.kind === "number" ? meta.step : 1;
  const places = step >= 1 ? 0 : String(step).split(".")[1]?.length ?? 2;
  const snapped = lo + Math.round((lo + random() * (hi - lo) - lo) / step) * step;
  return Number(Math.min(hi, Math.max(lo, snapped)).toFixed(places));
}

/**
 * A carousel nobody would have dialled in.
 *
 * The point of this button is the styles between the twelve — the ones you find
 * by accident and would never have reached by dragging one slider at a time.
 *
 * `random` is injectable so a test can walk it rather than hope.
 */
export function randomParams(
  current: CarouselParams,
  random: () => number = Math.random,
): CarouselParams {
  const next: CarouselParams = { ...current };

  for (const key of Object.keys(RANDOM_RANGES) as (keyof CarouselParams)[]) {
    (next as unknown as Record<string, number>)[key] = pick(key, random);
  }

  next.invert = random() < 0.25;
  next.bandRows = random() < 0.2 ? 2 : 1;
  next.easing = EASINGS[Math.min(EASINGS.length - 1, Math.floor(random() * EASINGS.length))];
  next.rings =
    random() < 0.25
      ? [
          { scale: 1, drift: 0 },
          { scale: 1.4, drift: 0 },
        ]
      : [{ scale: 1, drift: 0 }];

  // Turned cards with nothing between them in depth pass through each other, and
  // no amount of stacking work rescues a self-intersecting shape — see the note
  // on cautionReason. So the one arrangement the engine cannot draw is the one
  // the dice are not allowed to roll.
  if (cautionReason("cardAngle", next) !== null) next.cardAngle = 0;

  return next;
}
