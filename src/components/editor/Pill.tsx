"use client";

import type { Option } from "@/engine/defaults";

export interface PillProps {
  /** Names the group for a screen reader; drawn by the row, not by the pill. */
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A short list of choices as one object.
 *
 * The lit half is a single element that slides, rather than a background turned
 * on for one button and off for another. Two backgrounds crossfading reads as
 * two things blinking; one thing moving reads as a choice being made.
 */
export function Pill({ label, options, value, onChange, disabled }: PillProps) {
  // A value the options do not cover would otherwise light nothing at all, and
  // an unlit pill reads as broken rather than as unset.
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="cg-pill"
      style={{ ["--i" as string]: index, ["--n" as string]: options.length }}
    >
      <span className="cg-pill__lit" aria-hidden />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`cg-pill__option truncate ${
            option.value === value ? "text-cg-text" : "text-cg-muted hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
