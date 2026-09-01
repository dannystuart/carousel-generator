"use client";

import type { ReactNode } from "react";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Faded out with everything else while the screen is cleared for a look. */
  hidden?: boolean;
  children: ReactNode;
}

/**
 * The tools, and the edge you pull them out by.
 *
 * The drawer's width animates and its contents do not: the panel inside is
 * always its full width, pinned to the right, and the drawer crops it. Squashing
 * the controls on the way out would reflow forty rows on every frame of the
 * transition, and it would read as the panel being *stretched* into place rather
 * than slid into place.
 *
 * The scene is a flex sibling, so this width is taken from it rather than laid
 * over it — the carousel is never underneath the tools.
 *
 * Only the shut state has a handle here. Open, the way out belongs beside the
 * title in the header, where it can be a proper button rather than a sliver.
 */
export function Drawer({ open, onOpenChange, hidden, children }: DrawerProps) {
  return (
    <aside
      className="cg-drawer relative shrink-0 overflow-hidden"
      data-open={open}
      data-hidden={hidden || undefined}
      aria-label="Carousel controls"
    >
      {/* Slid right off the edge when shut rather than merely cropped: cropped,
          the notch becomes a 26px keyhole with the right-hand slivers of forty
          controls showing through it. `inert` goes with it, so a tab press
          cannot land on a control nobody can see. */}
      <div
        className="cg-drawer__inner absolute inset-y-0 right-0 flex flex-col"
        inert={!open}
      >
        {children}
        {/* Anchored to the drawer rather than to the scrolling list, so it stays
            on the bottom edge instead of travelling up with the controls. */}
        <div className="cg-glow" aria-hidden />
      </div>

      {/* Fixed to the window, not placed in the drawer: the drawer crops to 26px
          when shut, and the widening that says "this opens" was being sliced off
          by that crop. */}
      {open || hidden ? null : (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-expanded={false}
          aria-label="Open the tools"
          className="cg-notch"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
            <path
              d="M10 3.5 5.5 8l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </aside>
  );
}
