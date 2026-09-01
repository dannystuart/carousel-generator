"use client";

export interface ResetButtonProps {
  /** What it puts back, for the label a screen reader reads. */
  what: string;
  onReset: () => void;
}

/**
 * The way back from an edit.
 *
 * Appears only on a control that has moved off the style's value, which is the
 * whole of its usefulness: a panel of forty dials with a reset on every one
 * says nothing, and a panel with three says exactly what you changed.
 */
export function ResetButton({ what, onReset }: ResetButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Reset ${what}`}
      title="Reset"
      onClick={onReset}
      // The slider under this takes a double-click as "back to the style", and
      // two quick clicks on the reset would otherwise ring that bell twice.
      onDoubleClick={(event) => event.stopPropagation()}
      className="cg-reset grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full text-cg-muted transition-colors hover:bg-white/10 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60"
    >
      <svg viewBox="0 0 16 16" width="10" height="10" fill="none" aria-hidden>
        <path
          d="M3.2 8a4.8 4.8 0 1 0 1.5-3.48"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M2.4 2.6v3h3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
