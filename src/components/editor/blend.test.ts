import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@/engine/defaults";
import { presetParams } from "@/engine/presets";
import { blendParams, settle } from "./blend";

describe("blendParams", () => {
  const from = presetParams("coverflow");
  const to = presetParams("fanned-arch");

  it("is the starting point at 0 and the destination at 1", () => {
    expect(blendParams(from, to, 0).curve).toBeCloseTo(from.curve, 9);
    expect(blendParams(from, to, 1)).toEqual(to);
  });

  it("puts the numbers half way at a half", () => {
    const middle = blendParams(from, to, 0.5);
    expect(middle.curve).toBeCloseTo((from.curve + to.curve) / 2, 9);
    expect(middle.spacing).toBeCloseTo((from.spacing + to.spacing) / 2, 9);
  });

  it("takes the destination's switches straight away, since they have no half way", () => {
    const middle = blendParams(from, to, 0.01);
    expect(middle.arrows).toBe(to.arrows);
    expect(middle.easing).toBe(to.easing);
    expect(middle.rings).toEqual(to.rings);
  });

  it("leaves no parameter behind", () => {
    const blended = blendParams(from, to, 0.5);
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      expect(blended, key).toHaveProperty(key);
    }
  });
});

describe("settle", () => {
  it("runs from 0 to 1 and never leaves the range", () => {
    expect(settle(0)).toBe(0);
    expect(settle(1)).toBe(1);
    for (let t = 0; t <= 1; t += 0.05) {
      expect(settle(t)).toBeGreaterThanOrEqual(0);
      expect(settle(t)).toBeLessThanOrEqual(1);
    }
  });

  it("clamps rather than overshooting when the clock runs past the end", () => {
    expect(settle(1.4)).toBe(1);
    expect(settle(-0.2)).toBe(0);
  });
});
