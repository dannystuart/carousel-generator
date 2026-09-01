"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { BACKDROP, BACKDROP_INK, PRESET_TWEEN_MS, PREVIEW_STAGE } from "@/components/previewStage";
import { VISIBLE, stageScale, weight } from "./fit";
import type { Extent } from "./fit";

export interface StageFrameProps {
  background: "light" | "dark";
  /**
   * How far the visitor has pushed the Zoom dial. Divided out of the measured
   * extent so the fit is of the arrangement itself, and multiplied back on by
   * the engine — see the note in fit.ts.
   */
  zoom: number;
  /** Changes whenever a dial moves, so the framing follows the arrangement. */
  fitKey: unknown;
  handle?: RefObject<StageHandle | null>;
  children: ReactNode;
}

export interface StageHandle {
  /**
   * The fit for whatever is rendered right now, without applying it.
   *
   * Lets a caller find out how a *different* arrangement wants to be framed:
   * render it, ask, put the old one back. All three inside one frame, so
   * nothing is ever painted in between.
   *
   * `zoom` is the Zoom value of the arrangement being measured. It defaults to
   * the one on the dial, but a caller measuring a *destination* must pass the
   * destination's own — the engine has just drawn at that zoom, and dividing it
   * out with the old value would misread the whole arrangement by the ratio.
   */
  measure(zoom?: number): number | null;
  /** Travel to a scale over `ms`, in step with something else that is moving. */
  glide(to: number, ms: number): void;
}

/** The smoothing on an ordinary re-measure, when nothing else is moving. */
const SETTLE_MS = 180;

/**
 * What the arrangement occupies, measured from the middle out.
 *
 * From the middle rather than corner to corner because the fit must not pan:
 * the arrangement stays centred, so what matters is the furthest any card
 * reaches from the centre, doubled.
 *
 * The applied scale is divided back out, which is what stops this chasing its
 * own tail — measure, scale, re-measure, and the second answer is the first one.
 */
function measure(host: HTMLElement, applied: number, zoom: number): Extent | null {
  // Everything but the dissolve's frozen clone (.cg-ghost) — a ghost is
  // yesterday's arrangement on its way out, not part of what is being framed.
  const cards = [...host.querySelectorAll<HTMLElement>(".cg-card")].filter(
    (card) => !card.closest(".cg-ghost"),
  );
  if (cards.length === 0 || applied <= 0 || zoom <= 0) return null;

  const frame = host.getBoundingClientRect();
  const cx = frame.left + frame.width / 2;
  const cy = frame.top + frame.height / 2;

  // Two passes, because a card's claim on the picture is relative to the
  // biggest one and there is no knowing which that is until they have all been
  // looked at. Rects are read once and kept; reading them twice would be a
  // second forced layout on every frame of a drag.
  const seen: { box: DOMRect; opacity: number; area: number }[] = [];
  let largest = 0;

  for (const card of cards) {
    // Off the inline style the engine wrote, not the computed one — this runs
    // on every frame a dial moves, and getComputedStyle per card would cost a
    // second pass over the whole tree.
    const opacity = card.style.opacity === "" ? 1 : Number(card.style.opacity);
    if (!(opacity > 0)) continue;

    const box = card.getBoundingClientRect();
    const area = box.width * box.height;
    if (area <= 0) continue;

    largest = Math.max(largest, area);
    seen.push({ box, opacity, area });
  }

  let halfWidth = 0;
  let halfHeight = 0;
  let counted = 0;

  for (const card of seen) {
    if (weight(card.area, largest, card.opacity) < VISIBLE) continue;
    counted += 1;
    halfWidth = Math.max(halfWidth, Math.abs(card.box.left - cx), Math.abs(card.box.right - cx));
    halfHeight = Math.max(halfHeight, Math.abs(card.box.top - cy), Math.abs(card.box.bottom - cy));
  }

  if (counted === 0) return null;
  return {
    width: (2 * halfWidth) / applied / zoom,
    height: (2 * halfHeight) / applied / zoom,
  };
}

/**
 * The preview, holding the arrangement at its true size and scaling the whole
 * picture to fit whatever room it has.
 *
 * Every parameter is in absolute pixels, tuned against a 1040×640 stage. Left to
 * itself in a 375px phone box, a 288px coverflow card fills the screen and you
 * see one card — which is not the carousel anybody chose. Scaling the stage
 * instead of the numbers keeps the composition identical at every width, and
 * keeps the copied code honest: what is on screen is what the numbers say, just
 * bigger or smaller.
 *
 * What that scale is fitted to changed on 11 Aug 2026. It used to be the
 * nominal box, and the box did the cropping. Full screen, that stopped working:
 * the box is wide and short, a window is nearly square, and the styles do not
 * share a shape — a vertical column is tall, a cylinder marquee is flat, a peek
 * stack is barely one card. Seven of the twelve gained from the extra room and
 * three were left sliced against the edge of the screen. So the frame is fitted
 * to each arrangement's own extent instead, measured rather than assumed.
 *
 * Dragging survives the scaling. The controller measures its own painted width
 * against its layout width on every press, so a scaled ancestor is already the
 * case it was built for — no special handling here.
 *
 * The clipping lives on this element and nowhere below it: `overflow` on either
 * .cg-root or .cg-stage flattens `preserve-3d` and the arrangement collapses
 * into a flat overlap. See docs/web-build-gotchas.md.
 */
export function StageFrame({ background, zoom, fitKey, handle, children }: StageFrameProps) {
  const box = useRef<HTMLDivElement>(null);
  const fitBox = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [duration, setDuration] = useState(SETTLE_MS);
  // The scale in force, for the next measurement to divide out. A ref because
  // the measuring runs from an effect that must not wait for a render to see it.
  const applied = useRef(1);
  const pending = useRef<number | null>(null);
  const widest = useRef<Extent | null>(null);

  /**
   * The scale actually painted this frame, not the one asked for.
   *
   * The two differ whenever the glide is mid-flight: `applied` jumps to the
   * destination the moment the glide starts, while the transition walks the
   * painted picture there over half a second. Card rectangles come off the
   * painted picture, so that is the number to divide back out — divide by
   * `applied` during a glide and everything measures small by however much of
   * the journey is left, which is how clicking styles quickly sent the camera
   * to a size no arrangement had asked for.
   */
  const paintedScale = useCallback(() => {
    const element = fitBox.current;
    if (!element) return applied.current;
    const transform = getComputedStyle(element).transform;
    // "matrix(a, …)" and "matrix3d(m11, …)" both lead with the x scale.
    const lead = /^matrix(?:3d)?\(\s*(-?[\d.e+-]+)/.exec(transform);
    const painted = lead ? Number(lead[1]) : NaN;
    return Number.isFinite(painted) && painted > 0 ? painted : applied.current;
  }, []);

  /**
   * Measure on the next frame, and only once however many times this is asked.
   *
   * The previous frame is cancelled rather than the new request being dropped.
   * Dropping looks equivalent and is not: a cleanup that cancels an in-flight
   * frame would leave the "one is already booked" flag set with nothing coming
   * to clear it, and every later request would be turned away for ever. React
   * runs effects twice in development, so that deadlock is not a rare case —
   * it is the first thing that happens.
   */
  const refit = useCallback(() => {
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      pending.current = null;
      const element = box.current;
      if (!element) return;

      const frame = { width: element.clientWidth, height: element.clientHeight };
      if (frame.width <= 0 || frame.height <= 0) return;

      const seen = measure(element, paintedScale(), zoom);
      // The widest this arrangement has been seen since the last time a dial
      // moved. Two of the twelve turn on their own, and one snapshot of a
      // turning ring is one arbitrary moment of it — measure at the wrong one
      // and a card ends up hanging over the edge. The high-water mark is reset
      // on every change, so a slider being dragged still frames what it is
      // doing now rather than the largest thing it passed through.
      if (seen) {
        const was = widest.current;
        widest.current = was
          ? { width: Math.max(was.width, seen.width), height: Math.max(was.height, seen.height) }
          : seen;
      }

      const next = stageScale(widest.current, frame, PREVIEW_STAGE);

      // A hair of slack, so a rounding difference cannot start the measurement
      // and the scale nudging each other back and forth for ever.
      if (Math.abs(next - applied.current) < 0.001) return;
      applied.current = next;
      setScale(next);
      setDuration(SETTLE_MS);
    });
  }, [zoom, paintedScale]);

  useImperativeHandle(
    handle,
    () => ({
      measure(atZoom = zoom) {
        const element = box.current;
        if (!element) return null;
        const frame = { width: element.clientWidth, height: element.clientHeight };
        if (frame.width <= 0 || frame.height <= 0) return null;
        return stageScale(measure(element, paintedScale(), atZoom), frame, PREVIEW_STAGE);
      },
      glide(to, ms) {
        // A new arrangement, so the high-water mark from the last one is gone.
        widest.current = null;
        applied.current = to;
        setDuration(ms);
        setScale(to);
      },
    }),
    [zoom, paintedScale],
  );

  useEffect(() => {
    widest.current = null;
    refit();
    // Two more looks once the dust has settled, for the arrangements that keep
    // moving after the dials stop. Bounded on purpose: a permanent watch would
    // cost a forced layout every frame for ever, to catch a card at the edge of
    // a ring that turns once every forty seconds.
    const later = [setTimeout(refit, 420), setTimeout(refit, 980)];
    return () => later.forEach(clearTimeout);
  }, [refit, fitKey]);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(refit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [refit]);

  useEffect(
    () => () => {
      if (pending.current !== null) cancelAnimationFrame(pending.current);
    },
    [],
  );

  return (
    <div
      ref={box}
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: BACKDROP[background],
        // The ink the carousel's own arrows and dots inherit. Without it they
        // took the app's near-white text onto the light backdrop as well and
        // sat at 1.05:1 against it — see BACKDROP_INK.
        color: BACKDROP_INK[background],
        // Travels with the cards rather than ahead of them. Linear on purpose:
        // eased, the light half of a light-to-dark change lingers and the change
        // arrives as a late lurch instead of as one move.
        transition: `background-color ${PRESET_TWEEN_MS}ms linear, color ${PRESET_TWEEN_MS}ms linear`,
      }}
    >
      {/* The smoothing lives in the stylesheet, not here: an inline transition
          cannot be switched off by a reduced-motion rule, and this one has to
          be. */}
      <div
        ref={fitBox}
        className="cg-stage-fit absolute left-1/2 top-1/2"
        style={{
          width: PREVIEW_STAGE.width,
          height: PREVIEW_STAGE.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          ["--cg-fit-ms" as string]: `${duration}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
