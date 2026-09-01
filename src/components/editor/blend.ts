import { DEFAULT_PARAMS } from "@/engine/defaults";
import type { CarouselParams } from "@/engine/types";

/**
 * Numbers the engine rounds to a whole one before deciding something structural,
 * rather than using as a quantity. They are counts wearing a slider, so they
 * cannot travel: `bandRows` reads as one row until it passes 1.5 and as two
 * after, which lands the whole set in different places from one frame to the
 * next — measured at 1778px of movement in a single frame, halfway through
 * Depth tunnel's 520ms. They take the destination's value at once instead, at
 * the same instant as the card set itself, and everything else eases around it.
 */
const STRUCTURAL: readonly (keyof CarouselParams)[] = ["bandRows"];

/**
 * A point part-way between two parameter sets.
 *
 * Picking a preset moves the sliders to their new values in front of you rather
 * than snapping them, which is the spec's one piece of teaching: you watch which
 * dials a style is made of. Only the numbers can travel — a boolean, an easing
 * name and a row count have no half-way — so those take the destination's value
 * at once and the numbers catch up.
 */
export function blendParams(from: CarouselParams, to: CarouselParams, k: number): CarouselParams {
  if (k >= 1) return { ...to };
  const out = { ...to };
  for (const key of Object.keys(DEFAULT_PARAMS) as (keyof CarouselParams)[]) {
    if (STRUCTURAL.includes(key)) continue;
    const a = from[key];
    const b = to[key];
    if (typeof a === "number" && typeof b === "number") {
      // @ts-expect-error — narrowed to the numeric members by the runtime check.
      out[key] = a + (b - a) * k;
    }
  }
  return out;
}

/** The easing the rest of the tool uses for a move, so a preset change feels the same. */
export function settle(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}
