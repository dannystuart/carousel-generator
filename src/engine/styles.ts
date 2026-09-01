export const STYLE_ELEMENT_ID = "cg-styles";

/**
 * The static half of the carousel's CSS. Everything that depends on a parameter
 * is written inline by the controller instead, which keeps this sheet the same
 * for every carousel on a page and means the exported markup's first paint is
 * already correct without the script having run.
 *
 * Four rules here are load-bearing, all of them from docs/web-build-gotchas.md:
 *
 * 1. No `transition` on `.cg-item`'s transform. The controller writes that
 *    property 60 times a second; a transition on the same property is a
 *    low-pass filter and the motion comes out smaller and later than the
 *    numbers say. All easing happens in JS, in the animator.
 * 2. `filter` lives on `.cg-card`, never `.cg-item`. A filter creates a
 *    containing block and flattens its subtree out of the 3D context; one level
 *    below the transformed element, the 3D sort survives.
 * 3. No `overflow: hidden` on `.cg-root` or `.cg-stage` — either one flattens
 *    `preserve-3d`. Clip a parent of `.cg-root` if clipping is needed.
 * 4. `touch-action` is `pan-y`, not `none`: a horizontal drag is ours, a
 *    vertical one still scrolls the visitor's page. Same reasoning as leaving
 *    the mouse wheel off by default.
 */
/**
 * The sheet in named pieces, so the exported snippet can carry only the rules
 * its own settings actually use — a carousel with no dots has no business
 * shipping dot styles into somebody else's page. The engine itself always uses
 * all of them, since a live editor can turn anything on at any moment.
 */
export const CSS_BLOCKS = {
  base: `
.cg-root {
  position: relative;
  overflow: visible;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.cg-root:focus { outline: none; }
.cg-root:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }
.cg-root[data-cg-drag="1"] { cursor: grab; }
.cg-root[data-cg-dragging="1"] { cursor: grabbing; }

.cg-stage {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}

.cg-item {
  position: absolute;
  top: 50%;
  left: 50%;
  /* Cards take the pointer so one can be tapped to bring it to the centre. The
     stage around them does not, so a press on empty space still starts a drag
     on the root. */
  pointer-events: auto;
}
.cg-root[data-cg-tap="1"] .cg-card { cursor: pointer; }

/* Set by the controller while the loop is running and removed the moment it
   settles. A standing will-change is a promoted GPU layer per card for a
   carousel that is not moving. */
.cg-root[data-cg-moving="1"] .cg-item { will-change: transform; }

.cg-card {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #0b0b0d;
  backface-visibility: hidden;
}
.cg-card { text-decoration: none; color: inherit; }
.cg-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.cg-root--reduced .cg-card { transition: opacity 180ms linear; }
`,

  content: `
.cg-card { text-decoration: none; color: inherit; }
/* A card's own words and button.
   Everything below here is meant to be edited by whoever pastes this — it is
   deliberately plain, because it has to sit on somebody else's design.
   The zoom is on the picture, never on the card: growing the card swings its
   edges out of its own plane and cards on a ring sit close enough to their
   neighbours to cut into them.

   The panel is sized from the one font-size below and everything in it is a
   fraction of that, so there is a single number to change if you want the whole
   thing bigger. The script sets --cg-fit from the card's own size: 1 at the card
   these numbers were tuned on, less below it, never more. That is what stops a
   small card cropping its own words — the panel shrinks with it instead of
   standing 15px tall on a card too short to hold it. The two --cg-*-scale dials
   ride on top, for taste. */
.cg-content {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: calc(16px * var(--cg-fit, 1));
  gap: 0.375em;
  padding: 0.875em 1em 1em;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
  color: #fff;
  opacity: 0;
  transform: translateY(0.5em);
  transition: opacity 260ms ease, transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}
.cg-title { margin: 0; font-size: calc(0.94em * var(--cg-text-scale, 1)); font-weight: 600; line-height: 1.25; }
.cg-caption { margin: 0; font-size: calc(0.78em * var(--cg-text-scale, 1)); line-height: 1.4; opacity: 0.8; }
/* The pill's padding is in its own em, so it stays a pill at any button size. */
.cg-cta {
  margin-top: 0.125em;
  padding: 0.5em 1em;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 999px;
  font-size: calc(0.75em * var(--cg-cta-scale, 1));
  line-height: 1;
}

/* The other layout: nothing but the button, centred on the card over a soft
   veil. The title and caption stay in the markup and move off screen rather
   than display:none — they are a screen reader's only route into the card,
   and the layout only decides what sighted eyes get. */
.cg-root[data-cg-content="button"] .cg-content {
  inset: 0;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.22);
}
.cg-root[data-cg-content="button"] .cg-title,
.cg-root[data-cg-content="button"] .cg-caption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.cg-root[data-cg-reveal="focus"] .cg-item[data-cg-focused] .cg-content,
.cg-root[data-cg-reveal="both"] .cg-item[data-cg-focused] .cg-content,
.cg-root[data-cg-reveal="hover"] .cg-card:hover .cg-content,
.cg-root[data-cg-reveal="both"] .cg-card:hover .cg-content {
  opacity: 1;
  transform: none;
}
.cg-root[data-cg-reveal="focus"] .cg-item[data-cg-focused] .cg-card img,
.cg-root[data-cg-reveal="both"] .cg-item[data-cg-focused] .cg-card img,
.cg-root[data-cg-reveal="hover"] .cg-card:hover img,
.cg-root[data-cg-reveal="both"] .cg-card:hover img {
  transform: scale(var(--cg-reveal-zoom, 1.06));
}

@media (prefers-reduced-motion: reduce) {
  .cg-card img,
  .cg-content { transition-duration: 1ms; }
}
`,

  arrows: `
.cg-arrows { position: absolute; inset: auto 0 14px 0; display: flex; gap: 10px; justify-content: center; }
/* Outline only, no fill: a filled disc reads as a grey blob parked on the
   picture, and this sits over somebody else's design as often as ours. The
   44px is the tap target, not the drawing — see the spec's §12.

   The resting opacity is 0.45 rather than a rounder 0.4 because of which way
   the ink is going. currentColor over a background at 40% lands at 3.2:1 on a
   dark page and only 2.7:1 on a light one — dark ink loses more of itself to a
   pale backdrop than pale ink does to a dark one, so a single number that
   looked deliberately quiet on our own dark demo was under the 3:1 floor for a
   control on everybody's white page. 0.45 clears it on both, and is still
   quiet. */
.cg-arrow {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 15px;
  line-height: 1;
  opacity: 0.45;
  cursor: pointer;
  transition: opacity 160ms ease;
}
.cg-arrow:hover { opacity: 0.85; }
.cg-arrow:focus-visible { opacity: 0.85; }
.cg-arrow:disabled { opacity: 0.18; cursor: default; }
`,

  dots: `
.cg-dots {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 2;
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  min-height: 44px;
}
.cg-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.3;
  cursor: pointer;
}
.cg-dot[aria-current="true"] { opacity: 1; }
`,
} as const;

/** Everything, in order — what the engine injects when nothing else has. */
export const CAROUSEL_CSS = Object.values(CSS_BLOCKS).join("\n");

/** Injects the sheet once per document. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CAROUSEL_CSS;
  doc.head.appendChild(style);
}
