"use client";

import { useRef } from "react";
import type { KeyboardEventHandler, PointerEvent as ReactPointerEvent } from "react";
import { ResetButton } from "./ResetButton";

export interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** A marker moving out from the middle, for a dial whose halves are opposites. */
  centred?: boolean;
  /** The current style's value. A double-click and the reset both go here. */
  baseline: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Replaces the number, where a bare figure would not say enough. */
  readout?: (value: number) => string;
  /** For the ring sliders, whose label is drawn by their own row. */
  ariaLabel?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

/** Decimal places implied by the step, so 0.05 reads "1.35" and 1 reads "52". */
function places(step: number): number {
  return step >= 1 ? 0 : String(step).split(".")[1]?.length ?? 2;
}

function format(value: number, step: number): string {
  return value.toFixed(places(step));
}

/** Back onto the step grid, and out of floating point's way. */
function quantise(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(places(step)));
}

/**
 * Pixels of drag on the number that buy one step.
 *
 * The track is the coarse control and the number is the fine one. A hundred-step
 * dial is about three pixels a step across a 330px capsule, which is no way to
 * land on a value on purpose; eight pixels is slow enough to aim with.
 */
const SCRUB_PX = 8;

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  centred,
  baseline,
  disabled,
  onChange,
  readout,
  ariaLabel,
  onKeyDown,
}: SliderProps) {
  const span = max - min;
  const k = span > 0 ? (value - min) / span : 0;
  const edited = value !== baseline;

  // Where the scrub started. Held in a ref rather than in state because it is
  // read by a pointer handler that cannot wait for a render to see it.
  const scrub = useRef<{ x: number; from: number } | null>(null);

  const onScrubDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { x: event.clientX, from: value };
  };

  const onScrubMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const start = scrub.current;
    if (!start) return;
    const steps = Math.round((event.clientX - start.x) / SCRUB_PX);
    const next = quantise(start.from + steps * step, min, max, step);
    if (next !== value) onChange(next);
  };

  const onScrubUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    scrub.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="cg-slider" style={{ ["--k" as string]: k }}>
      <span className="cg-slider__ticks" aria-hidden />
      {centred ? (
        <span className="cg-slider__centre" aria-hidden />
      ) : (
        <span className="cg-slider__fill" aria-hidden />
      )}
      <span className="cg-slider__mark" aria-hidden />

      <label htmlFor={id} className="cg-slider__label truncate text-[12.5px] leading-none text-cg-text">
        {label}
      </label>

      <span className="cg-slider__value flex shrink-0 items-center gap-1.5">
        {edited ? <ResetButton what={label} onReset={() => onChange(baseline)} /> : null}
        <span
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
          className={`select-none font-cg-mono text-[11px] tabular-nums leading-none text-cg-muted ${
            disabled ? "" : "cursor-ew-resize"
          }`}
        >
          {readout ? readout(value) : `${format(value, step)}${unit ?? ""}`}
        </span>
      </span>

      <input
        id={id}
        type="range"
        aria-label={ariaLabel}
        className="cg-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => onChange(baseline)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
