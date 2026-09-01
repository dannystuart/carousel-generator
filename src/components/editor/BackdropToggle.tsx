"use client";

import type { Backdrop } from "@/components/previewStage";

export interface BackdropToggleProps {
  value: Backdrop;
  onChange: (value: Backdrop) => void;
}

const CHOICES: { value: Backdrop; label: string; swatch: string; ring: string }[] = [
  { value: "light", label: "Light backdrop", swatch: "#f4f4f5", ring: "rgba(0,0,0,0.25)" },
  { value: "dark", label: "Dark backdrop", swatch: "#08080a", ring: "rgba(255,255,255,0.3)" },
];

/**
 * What the carousel is standing on.
 *
 * It lives on the picture rather than in the drawer with the dials, because it
 * is not one of them: the backdrop is the page a carousel would sit on, not a
 * property of the carousel, and nothing about it travels into the code you copy
 * out. Two of the twelve ship dark because their imagery needed it — this is
 * how you disagree with that.
 */
export function BackdropToggle({ value, onChange }: BackdropToggleProps) {
  return (
    <div className="cg-backdrop" role="radiogroup" aria-label="Backdrop">
      {CHOICES.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={value === choice.value}
          aria-label={choice.label}
          title={choice.label}
          onClick={() => onChange(choice.value)}
          className="cg-backdrop__swatch"
          data-on={value === choice.value || undefined}
          style={{
            ["--swatch" as string]: choice.swatch,
            ["--swatch-ring" as string]: choice.ring,
          }}
        />
      ))}
    </div>
  );
}
