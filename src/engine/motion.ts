import { EASINGS } from "./easing";
import type { CarouselParams } from "./types";

/** Momentum time constant at dragWeight 1, in ms. */
const FLING_TAU_MS = 320;

/** Cards per ms below which a fling is over. */
const MIN_FLING_VELOCITY = 1e-4;

/** A long flick should take longer than a nudge, but not indefinitely longer. */
const MAX_FLING_DURATION_SCALE = 2.5;

export interface Animator {
  position(): number;
  target(): number;
  goTo(target: number, now: number): void;
  /** Free-drag: set position directly, cancelling any tween. */
  set(position: number): void;
  /** Release a flick with velocity in cards/ms. */
  fling(velocity: number, now: number): void;
  /** Advance to `now`. Returns true while there is still something to animate. */
  tick(now: number): boolean;
  settled(): boolean;
}

/**
 * Position in card units, driven by an explicit clock.
 *
 * Nothing here touches requestAnimationFrame or the DOM — the controller owns
 * the loop and hands `now` in — so the whole of the motion is unit-testable and
 * the exported snippet runs the same state machine as the preview.
 *
 * Position is deliberately unbounded: at 12 cards it is free to reach 37, and
 * wrappedOffset does the modular arithmetic at render time. Wrapping it here
 * would put a seam in the middle of a tween.
 */
export function createAnimator(readParams: () => CarouselParams, startPosition = 0): Animator {
  let pos = startPosition;

  type Mode = "idle" | "tween" | "fling";
  let mode: Mode = "idle";

  // tween
  let from = startPosition;
  let to = startPosition;
  let startTime = 0;
  let duration = 0;

  // fling
  let flingV0 = 0;
  let flingTau = 0;
  let flingFrom = startPosition;
  let flingRest = startPosition;

  const baseDuration = () => {
    const p = readParams();
    return Math.max(0, p.speed) * EASINGS[p.easing].durationScale;
  };

  function startTween(destination: number, now: number, durationMs: number) {
    if (!(durationMs > 0)) {
      // Reduced motion sets Speed to 0. Arrive immediately rather than leaning
      // on a tick that may never come.
      pos = destination;
      to = destination;
      mode = "idle";
      return;
    }
    from = pos;
    to = destination;
    startTime = now;
    duration = durationMs;
    mode = "tween";
  }

  return {
    position: () => pos,

    target: () => {
      if (mode === "tween") return to;
      if (mode === "fling") return flingRest;
      return pos;
    },

    goTo(destination, now) {
      startTween(destination, now, baseDuration());
    },

    set(position) {
      pos = position;
      to = position;
      mode = "idle";
    },

    fling(velocity, now) {
      const p = readParams();
      flingTau = FLING_TAU_MS * Math.max(0, p.dragWeight);
      const travel = velocity * flingTau;

      if (p.snap) {
        // Predict where the momentum would put it, then go to that card in one
        // eased move — one smooth motion to a definite card, rather than a
        // decay followed by a second little correction.
        const projected = Math.round(pos + travel);
        const distance = Math.abs(projected - pos);
        const scale = Math.min(MAX_FLING_DURATION_SCALE, 1 + 0.35 * Math.max(0, distance - 1));
        startTween(projected, now, baseDuration() * scale);
        return;
      }

      if (!(flingTau > 0) || Math.abs(velocity) < MIN_FLING_VELOCITY) {
        mode = "idle";
        return;
      }
      flingV0 = velocity;
      flingFrom = pos;
      flingRest = pos + travel;
      startTime = now;
      mode = "fling";
    },

    tick(now) {
      if (mode === "tween") {
        const t = (now - startTime) / duration;
        if (t >= 1) {
          pos = to;
          mode = "idle";
          return false;
        }
        pos = from + (to - from) * EASINGS[readParams().easing].ease(Math.max(0, t));
        return true;
      }

      if (mode === "fling") {
        const elapsed = Math.max(0, now - startTime);
        const remaining = Math.exp(-elapsed / flingTau);
        if (Math.abs(flingV0 * remaining) < MIN_FLING_VELOCITY) {
          pos = flingRest;
          mode = "idle";
          return false;
        }
        pos = flingFrom + flingV0 * flingTau * (1 - remaining);
        return true;
      }

      return false;
    },

    settled: () => mode === "idle",
  };
}
