/**
 * The size of the editor's live preview at a 1440×900 window — a large preview
 * on the left, the control panel on the right, the outputs beneath.
 *
 * Every preset's numbers are in absolute pixels, so they were tuned against
 * *this* box. The editor has to build to it or the twelve arrive off-centre and
 * the wrong size, so it lives here rather than being retyped in two places.
 */
export const PREVIEW_STAGE = { width: 1040, height: 640 } as const;

/**
 * How long the sliders take to walk to a newly picked style.
 *
 * Shared with the preview box, which changes from a light background to a dark
 * one on four of the twelve. Left to snap, that change lands on the frame the
 * style is picked while the cards are still 520ms from arriving — the flash
 * reads as the whole transition stuttering, which is what made Depth tunnel and
 * Fanned arch feel worse than the styles that stay light.
 */
export const PRESET_TWEEN_MS = 520;

/**
 * What the preview sits on, per style.
 *
 * Shared with the shell around it: with the drawer shut, its 26px notch strip
 * has to be the same colour as the scene or it reads as a black band down the
 * edge of a light arrangement.
 */
export const BACKDROP = { light: "#f4f4f5", dark: "#08080a" } as const;

/**
 * The ink to draw *on* each of those.
 *
 * The engine's arrows and dots are drawn in `currentColor` on purpose: they have
 * to sit on somebody else's design, and taking that page's own text colour is
 * what lets them. Which means anything showing a carousel has to have a text
 * colour that suits what the carousel is standing on — and this app is dark
 * throughout, so its near-white ink came through onto the light backdrop too.
 * Measured at 1.05:1 against it: the arrows were in the markup, in the right
 * place, the right size, and invisible.
 *
 * So it travels with the backdrop rather than being set once by the app. Same
 * two values the app itself uses for ink on each shade, and it must stay beside
 * BACKDROP — a backdrop whose ink is chosen somewhere else is how this happened.
 */
export const BACKDROP_INK = { light: "#08090b", dark: "#e9e7e2" } as const;

/** Which of the two the scene is standing on. */
export type Backdrop = keyof typeof BACKDROP;
