import { describe, it, expect } from "vitest";
import { createAnimator } from "./motion";
import { DEFAULT_PARAMS } from "./defaults";
import { EASINGS } from "./easing";
import type { CarouselParams } from "./types";

/** An animator over a mutable params object, so a test can change a setting mid-flight. */
function make(over: Partial<CarouselParams> = {}, startPosition = 0) {
  const params: CarouselParams = { ...DEFAULT_PARAMS, ...over };
  return { params, animator: createAnimator(() => params, startPosition) };
}

/** Run the clock forward until the animator settles, or give up. */
function runToRest(a: ReturnType<typeof make>["animator"], from = 0, step = 16, limit = 600) {
  let now = from;
  for (let i = 0; i < limit; i++) {
    now += step;
    if (!a.tick(now)) return now;
  }
  throw new Error("never settled");
}

describe("createAnimator", () => {
  it("starts settled at its start position", () => {
    const { animator } = make({}, 4);
    expect(animator.position()).toBe(4);
    expect(animator.target()).toBe(4);
    expect(animator.settled()).toBe(true);
    expect(animator.tick(16)).toBe(false);
  });

  it("reaches the target after speed × multiplier ms, and not before", () => {
    const { animator } = make({ speed: 620, easing: "settle" });
    const duration = 620 * EASINGS.settle.durationScale;

    animator.goTo(1, 0);
    expect(animator.target()).toBe(1);

    expect(animator.tick(duration - 1)).toBe(true);
    expect(animator.position()).toBeLessThan(1);
    expect(animator.settled()).toBe(false);

    expect(animator.tick(duration)).toBe(false);
    expect(animator.position()).toBe(1);
    expect(animator.settled()).toBe(true);
  });

  it("honours each easing's duration multiplier", () => {
    for (const easing of ["snap", "glide", "overshoot"] as const) {
      const { animator } = make({ speed: 1000, easing });
      const duration = 1000 * EASINGS[easing].durationScale;
      animator.goTo(1, 0);
      expect(animator.tick(duration - 1), easing).toBe(true);
      expect(animator.tick(duration), easing).toBe(false);
      expect(animator.position(), easing).toBe(1);
    }
  });

  it("stays settled once it has settled, so the rAF loop can stop", () => {
    const { animator } = make({ speed: 200, easing: "settle" });
    animator.goTo(2, 0);
    runToRest(animator);
    expect(animator.tick(9999)).toBe(false);
    expect(animator.tick(99999)).toBe(false);
  });

  it("retargets mid-tween from the current position, without jumping", () => {
    const { animator } = make({ speed: 620, easing: "settle" });
    animator.goTo(1, 0);
    animator.tick(300);
    const midway = animator.position();
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1);

    animator.goTo(3, 300);
    expect(animator.position()).toBe(midway); // no jump on the retarget
    expect(animator.target()).toBe(3);

    animator.tick(300 + 620);
    expect(animator.position()).toBe(3);
  });

  it("lets a drag set the position directly, cancelling any tween", () => {
    const { animator } = make({ speed: 620 });
    animator.goTo(5, 0);
    animator.tick(100);
    animator.set(-1.75);
    expect(animator.position()).toBe(-1.75);
    expect(animator.target()).toBe(-1.75);
    expect(animator.settled()).toBe(true);
    expect(animator.tick(200)).toBe(false);
  });

  it("decays a fling to rest", () => {
    const { animator } = make({ snap: false, dragWeight: 1 });
    animator.fling(0.004, 0);
    expect(animator.settled()).toBe(false);
    runToRest(animator);
    expect(animator.settled()).toBe(true);
    // Momentum carried it forward and it stopped somewhere past a card.
    expect(animator.position()).toBeGreaterThan(1);
    expect(Number.isFinite(animator.position())).toBe(true);
  });

  it("lands a fling on an integer when snapping", () => {
    const { animator } = make({ snap: true, dragWeight: 1 });
    animator.fling(0.004, 0);
    runToRest(animator);
    expect(Number.isInteger(animator.position())).toBe(true);
    expect(animator.position()).toBeGreaterThan(0);
  });

  it("flings backwards on a negative velocity", () => {
    const { animator } = make({ snap: true, dragWeight: 1 });
    animator.fling(-0.004, 0);
    runToRest(animator);
    expect(animator.position()).toBeLessThan(0);
    expect(Number.isInteger(animator.position())).toBe(true);
  });

  it("carries further with a heavier drag weight", () => {
    const light = make({ snap: false, dragWeight: 0.4 });
    const heavy = make({ snap: false, dragWeight: 2.5 });
    light.animator.fling(0.004, 0);
    heavy.animator.fling(0.004, 0);
    runToRest(light.animator);
    runToRest(heavy.animator);
    expect(heavy.animator.position()).toBeGreaterThan(light.animator.position());
  });

  it("snaps to the nearest card with no momentum at all", () => {
    const { animator } = make({ snap: true, dragWeight: 0 }, 2.4);
    animator.fling(0.004, 0);
    runToRest(animator);
    expect(animator.position()).toBe(2);
  });

  it("arrives in one tick under reduced motion, where speed is 0", () => {
    const { animator } = make({ speed: 0 });
    animator.goTo(3, 0);
    expect(animator.tick(16)).toBe(false);
    expect(animator.position()).toBe(3);
    expect(animator.settled()).toBe(true);
  });

  it("picks up a changed speed on the next move", () => {
    const state = make({ speed: 200, easing: "settle" });
    state.animator.goTo(1, 0);
    state.animator.tick(200);
    expect(state.animator.position()).toBe(1);

    state.params.speed = 800;
    state.animator.goTo(2, 200);
    expect(state.animator.tick(200 + 799)).toBe(true);
    expect(state.animator.tick(200 + 800)).toBe(false);
  });

  it("never emits NaN, even asked to go nowhere", () => {
    const { animator } = make({ speed: 620 });
    animator.goTo(0, 0);
    expect(Number.isFinite(animator.position())).toBe(true);
    animator.tick(310);
    expect(Number.isFinite(animator.position())).toBe(true);
    animator.fling(0, 400);
    runToRest(animator, 400);
    expect(Number.isFinite(animator.position())).toBe(true);
  });
});
