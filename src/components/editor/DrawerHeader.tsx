"use client";

import { COPY } from "@/data/copy";
import { PRESETS } from "@/engine/presets";

export interface DrawerHeaderProps {
  active: string;
  edited: boolean;
  onPick: (slug: string) => void;
  onReset: () => void;
  onClose: () => void;
  query: string;
  onQuery: (query: string) => void;
}

const Reset = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" aria-hidden>
    <path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="M2.4 2.6v3h3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The part of the drawer that never scrolls: what this is, which style you are
 * on, and the way to find a control among forty.
 *
 * Picking a style moves the sliders to their new values in front of you, which
 * is the only teaching this tool does — you watch which dials a style is made of
 * and the model explains itself without a word of instruction. That is why the
 * styles are pinned here rather than folded away with everything else.
 */
export function DrawerHeader({
  active,
  edited,
  onPick,
  onReset,
  onClose,
  query,
  onQuery,
}: DrawerHeaderProps) {
  return (
    <div className="relative z-[2] shrink-0 border-b border-cg-line bg-cg-panel px-4 pb-4 pt-4">
      {/* The tool's name and the way out share a line and a centre. The close
          was a 26px sliver hanging off the top corner, which is not something
          anybody would go looking for. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[11px] uppercase leading-none tracking-[0.16em] text-cg-faint">
          {COPY.h1}
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-expanded
          aria-label="Close the tools"
          title="Close the tools"
          className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-cg-muted transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-text active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <h2 className="text-[10.5px] uppercase tracking-[0.16em] text-cg-muted">Style</h2>
        <div className="flex items-center gap-1.5">
          {edited ? (
            <button
              type="button"
              onClick={onReset}
              className="cg-chip cg-reset"
              title="Put every dial back where this style had it"
            >
              <Reset />
              Reset
            </button>
          ) : null}
          {/* Surprise me was here. Taken out on 12 Aug 2026 — the idea is a good
              one and the implementation was not, so it is gone rather than
              broken. See src/engine/randomise.ts for what went wrong and what a
              working one would have to do differently. */}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const on = preset.slug === active;
          return (
            <button
              key={preset.slug}
              type="button"
              onClick={() => onPick(preset.slug)}
              aria-pressed={on}
              title={preset.oneLiner}
              className={`cg-style rounded-lg px-2.5 py-[6px] text-[11.5px] leading-none ${
                on && !edited
                  ? "bg-white/[0.13] text-cg-text"
                  : on
                    ? "bg-white/[0.06] text-cg-text"
                    : "text-cg-muted"
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      <div className="relative mt-4">
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cg-faint"
        >
          <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.4 10.4 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onQuery("");
          }}
          placeholder="Search controls"
          aria-label="Search controls"
          className="h-9 w-full rounded-[10px] bg-cg-raised pl-8 pr-3 text-[12px] text-cg-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] placeholder:text-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/50"
        />
      </div>
    </div>
  );
}
