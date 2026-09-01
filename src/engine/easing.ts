import type { Easing } from "./types";

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-6;
const SUBDIVISION_EPSILON = 1e-7;
const SUBDIVISION_MAX_ITERATIONS = 32;

/**
 * A CSS cubic-bezier as a plain function of progress.
 *
 * The curve runs (0,0) → (x1,y1) → (x2,y2) → (1,1). Progress is the x axis, so
 * each call solves x(s) = t for the curve parameter s, then reads y(s). Newton
 * does that in a handful of iterations everywhere the curve has slope; where it
 * flattens — and `settle` has x2 = 0, which is exactly that — it falls back to
 * bisection, which cannot diverge.
 *
 * Deliberately not a spring: the Speed slider is stated in milliseconds and the
 * Prompt output has to name a curve someone can paste into their own CSS.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  function solve(t: number): number {
    let s = t;
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const slope = slopeX(s);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
      const error = sampleX(s) - t;
      if (Math.abs(error) < SUBDIVISION_EPSILON) return s;
      s -= error / slope;
    }

    // Bisection. Newton may have walked outside [0,1]; start clean.
    let low = 0;
    let high = 1;
    s = t;
    for (let i = 0; i < SUBDIVISION_MAX_ITERATIONS; i++) {
      const value = sampleX(s);
      if (Math.abs(value - t) < SUBDIVISION_EPSILON) return s;
      if (value < t) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return s;
  }

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solve(t));
  };
}

export interface EasingSpec {
  /** The control points, in the order CSS writes them. */
  points: readonly [number, number, number, number];
  /** Multiplier on the Speed slider — glide takes longer than snap at the same setting. */
  durationScale: number;
  /** Eased progress, 0..1 in, 0..1 out (overshoot briefly exceeds 1). */
  ease: (t: number) => number;
  /** `cubic-bezier(…)`, quoted verbatim by the Code and Prompt outputs. */
  css: string;
}

function spec(points: readonly [number, number, number, number], durationScale: number): EasingSpec {
  return {
    points,
    durationScale,
    ease: cubicBezier(...points),
    css: `cubic-bezier(${points.join(", ")})`,
  };
}

export const EASINGS: Record<Easing, EasingSpec> = {
  settle: spec([0.32, 0.72, 0, 1], 1.0),
  snap: spec([0.4, 0, 0.2, 1], 0.55),
  glide: spec([0.65, 0, 0.35, 1], 1.35),
  overshoot: spec([0.34, 1.56, 0.64, 1], 1.1),
};
