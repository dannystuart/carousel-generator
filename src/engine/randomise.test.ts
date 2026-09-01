import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS, PARAM_META } from "./defaults";
import { cautionReason } from "./inert";
import { RANDOM_RANGES, randomParams } from "./randomise";
import type { CarouselParams } from "./types";

/** A repeatable stand-in for Math.random, walking a fixed list. */
const walk = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// Dormant along with the module it covers — "Surprise me" was taken out of the
// editor on 12 Aug 2026. Kept running so the code stays honest while it waits:
// see the note at the top of randomise.ts for why it was pulled and what a
// working one would do instead.
describe("the dormant randomiser", () => {
  it("only ever offers values a slider could reach", () => {
    for (const [key, range] of Object.entries(RANDOM_RANGES)) {
      const meta = PARAM_META[key as keyof CarouselParams];
      expect(meta.kind, `${key} is not a slider`).toBe("number");
      if (meta.kind !== "number") continue;
      expect(range![0], key).toBeGreaterThanOrEqual(meta.min);
      expect(range![1], key).toBeLessThanOrEqual(meta.max);
    }
  });

  it("lands inside its own ranges however the dice fall", () => {
    for (const dice of [0, 0.5, 1, 0.999]) {
      const next = randomParams(DEFAULT_PARAMS, () => dice);
      for (const [key, range] of Object.entries(RANDOM_RANGES)) {
        const value = next[key as keyof CarouselParams] as number;
        expect(value, `${key} at dice ${dice}`).toBeGreaterThanOrEqual(range![0]);
        expect(value, `${key} at dice ${dice}`).toBeLessThanOrEqual(range![1]);
      }
    }
  });

  /**
   * Whether visitors can drag, loop or see arrows is a decision about somebody's
   * site, not a look. Rolling dice on it would throw away a choice they made.
   */
  it("leaves what visitors can do exactly as it found it", () => {
    const next = randomParams(DEFAULT_PARAMS, walk([0.1, 0.9, 0.5, 0.3]));
    for (const key of [
      "drag",
      "dragWeight",
      "arrows",
      "dots",
      "loop",
      "snap",
      "wheel",
      "tapToFocus",
      "autoplay",
      "autoplayInterval",
      "pauseOnHover",
      "speed",
      "cardReveal",
      "contentLayout",
    ] as const) {
      expect(next[key], key).toBe(DEFAULT_PARAMS[key]);
    }
  });

  it("never rolls the one arrangement the engine cannot draw", () => {
    for (let i = 0; i < 300; i++) {
      const next = randomParams(DEFAULT_PARAMS);
      expect(
        cautionReason("cardAngle", next),
        JSON.stringify({ curve: next.curve, depth: next.depth, cardAngle: next.cardAngle }),
      ).toBeNull();
    }
  });

  it("actually changes something", () => {
    expect(randomParams(DEFAULT_PARAMS)).not.toEqual(DEFAULT_PARAMS);
  });
});
