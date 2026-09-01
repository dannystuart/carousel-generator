import { PARAM_META } from "@/engine/defaults";
import type { CarouselParams } from "@/engine/types";

/**
 * Which dials sit somewhere other than where the style put them.
 *
 * Drives three things at once: the reset beside a slider, the dot on a folded
 * section, and whether the header shows its "Edited" chip at all. One answer, so
 * the three can never disagree with each other.
 */
export function editedKeys(
  params: CarouselParams,
  baseline: CarouselParams,
): (keyof CarouselParams)[] {
  return (Object.keys(PARAM_META) as (keyof CarouselParams)[]).filter((key) => {
    const now = params[key];
    const was = baseline[key];
    // Only `rings` is not a primitive, and comparing it by reference would call
    // every freshly-built copy of the same rings an edit — which it is not.
    if (Array.isArray(now) || Array.isArray(was)) return JSON.stringify(now) !== JSON.stringify(was);
    return now !== was;
  });
}
