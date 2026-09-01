import { describe, it, expect } from "vitest";
import { cubicBezier, EASINGS } from "./easing";
import type { Easing } from "./types";

const NAMES: Easing[] = ["settle", "snap", "glide", "overshoot"];

describe("cubicBezier", () => {
  it("pins both ends exactly", () => {
    const f = cubicBezier(0.32, 0.72, 0, 1);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
  });

  it("clamps input outside 0..1", () => {
    const f = cubicBezier(0.4, 0, 0.2, 1);
    expect(f(-0.5)).toBe(0);
    expect(f(1.5)).toBe(1);
  });

  // With the y control points set equal to the x control points the curve is,
  // analytically, the identity — so |f(t) − t| is exactly the solver's residual
  // in x. These particular points make dx/ds vanish at s = 0.5, which is where
  // Newton stalls, so this measures the bisection fallback.
  it("converges within 1e-5 where the derivative vanishes", () => {
    const identity = cubicBezier(1, 1, 0, 0);
    let worst = 0;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      worst = Math.max(worst, Math.abs(identity(t) - t));
    }
    expect(worst).toBeLessThan(1e-5);
  });

  it("reproduces a linear curve exactly", () => {
    const linear = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(linear(t)).toBeCloseTo(t, 5);
    }
  });
});

describe("EASINGS", () => {
  it("has the four the spec names, and nothing else", () => {
    expect(Object.keys(EASINGS).sort()).toEqual([...NAMES].sort());
  });

  it("starts at 0 and ends at 1 for all four", () => {
    for (const name of NAMES) {
      expect(EASINGS[name].ease(0), name).toBe(0);
      expect(EASINGS[name].ease(1), name).toBe(1);
    }
  });

  it("keeps settle, snap and glide monotonic across 200 samples", () => {
    for (const name of ["settle", "snap", "glide"] as Easing[]) {
      let previous = -Infinity;
      for (let i = 0; i <= 200; i++) {
        const value = EASINGS[name].ease(i / 200);
        expect(value, `${name} at ${i / 200}`).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = value;
      }
    }
  });

  it("makes overshoot go past 1 in the middle and still land on 1", () => {
    let peak = 0;
    for (let i = 0; i <= 200; i++) peak = Math.max(peak, EASINGS.overshoot.ease(i / 200));
    expect(peak).toBeGreaterThan(1);
    expect(EASINGS.overshoot.ease(1)).toBe(1);
  });

  it("writes a css string matching its own control points", () => {
    for (const name of NAMES) {
      const spec = EASINGS[name];
      expect(spec.css, name).toBe(`cubic-bezier(${spec.points.join(", ")})`);
    }
    // The Prompt output quotes this verbatim, so pin the default.
    expect(EASINGS.settle.css).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
  });

  it("scales duration so snap is quicker than glide at the same speed", () => {
    expect(EASINGS.settle.durationScale).toBe(1);
    expect(EASINGS.snap.durationScale).toBeLessThan(EASINGS.settle.durationScale);
    expect(EASINGS.glide.durationScale).toBeGreaterThan(EASINGS.settle.durationScale);
    for (const name of NAMES) {
      expect(EASINGS[name].durationScale, name).toBeGreaterThan(0);
    }
  });
});
