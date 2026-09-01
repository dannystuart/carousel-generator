import type { CarouselParams } from "./types";

export type Group =
  | "essentials"
  | "camera"
  | "arrangement"
  | "cards"
  | "distance"
  | "randomness"
  | "content"
  | "movement"
  | "controls";

/**
 * The order the panel draws them in.
 *
 * Essentials has no fold — it is the six dials that do the most work and they
 * are always in reach. The rest are named for what somebody is looking for
 * rather than for how the engine is built: "Distance effects" is where you go
 * when the far cards are too sharp, and nobody has ever gone looking for a
 * "falloff".
 */
export const PARAM_GROUPS: { id: Group; title: string; folds: boolean }[] = [
  { id: "essentials", title: "Essentials", folds: false },
  { id: "camera", title: "Camera", folds: true },
  { id: "arrangement", title: "Arrangement", folds: true },
  { id: "cards", title: "The cards", folds: true },
  { id: "distance", title: "Distance effects", folds: true },
  { id: "randomness", title: "Randomness", folds: true },
  { id: "content", title: "Card content", folds: true },
  { id: "movement", title: "Movement", folds: true },
  { id: "controls", title: "What visitors can do", folds: true },
];

/** An enum or segment option: the engine's word, and the one people read. */
export interface Option {
  value: string;
  label: string;
}

type Meta =
  | {
      kind: "number";
      label: string;
      min: number;
      max: number;
      step: number;
      unit?: string;
      /**
       * Drawn with a marker that moves out from the middle rather than a fill
       * from the left end — for dials whose two halves mean opposite things.
       */
      centred?: true;
      /**
       * A line of plain English under the control, for the dials whose name
       * cannot carry the whole idea — what the two ends mean, or what the
       * number is really of.
       *
       * Only where it earns its line. "Corner radius" needs no help, and a hint
       * under every control is a wall of grey nobody reads.
       */
      hint?: string;
      group: Group;
    }
  | { kind: "boolean"; label: string; hint?: string; group: Group }
  | { kind: "enum"; label: string; options: Option[]; hint?: string; group: Group }
  /** A handful of whole numbers. A slider three notches wide is a lie. */
  | { kind: "segment"; label: string; options: Option[]; hint?: string; group: Group }
  | { kind: "rings"; label: string; hint?: string; group: Group };

export const DEFAULT_PARAMS: CarouselParams = {
  curve: 0.14, cardAngle: 52, depth: 1, spacing: 260, sizeFalloff: 0.22, speed: 620,
  pitch: 0, distance: 1400, zoom: 1, tilt: 0,
  invert: false, arcRotation: 0, rings: [{ scale: 1, drift: 0 }], bandRows: 1, risePerTurn: 0,
  blurFalloff: 0, fadeFalloff: 0.12, sizeGradient: 0, cardFacing: 0, jitter: 0,
  sizeJitter: 0, cardUpright: 0,
  cardWidth: 320, cardAspect: 1.32, cardRadius: 14, transparency: 0,
  cardReveal: "never", cardLink: "content", revealZoom: 1.06, contentLayout: "panel", buttonScale: 1, textScale: 1,
  easing: "settle",
  drag: true, dragWeight: 1, arrows: true, dots: false,
  autoplay: false, autoplayInterval: 3200, pauseOnHover: true,
  wheel: false, tapToFocus: true, loop: true, snap: true,
};

/**
 * Editor metadata for every parameter. The editor's controls are generated from
 * this, so a parameter added to the engine gets a control automatically and the
 * two cannot fall out of step.
 *
 * Labels are the words a visitor reads, and they are deliberately not the
 * engine's words — "Shrink with distance" rather than "Size falloff". The keys
 * are the engine's and never change, so nothing anybody copies out is affected
 * by a rename here. See docs/plans/2026-08-11-editor-ui-rework-design.md §3.
 */
export const PARAM_META: Record<keyof CarouselParams, Meta> = {
  // --- essentials: the six that do the most work ---
  curve: { kind: "number", label: "Curve", min: 0, max: 1, step: 0.01, hint: "A straight track at 0, a ring that closes at 1.", group: "essentials" },
  cardAngle: { kind: "number", label: "Card angle", min: 0, max: 90, step: 1, unit: "°", group: "essentials" },
  // Depth multiplies how far the curve recedes, so at curve 0 there is nothing
  // for it to multiply and the slider genuinely does nothing. Settled with Danny
  // on 10 Aug 2026 by looking at it: keep the honest model, and have the editor
  // dim the control and say why rather than give Depth a second, different job.
  // Same treatment for Distance, which is equally inert on a flat arrangement.
  depth: { kind: "number", label: "Depth", min: 0, max: 3, step: 0.05, unit: "×", hint: "Multiplies how far the curve recedes.", group: "essentials" },
  spacing: { kind: "number", label: "Spacing", min: 40, max: 600, step: 2, unit: "px", group: "essentials" },
  sizeFalloff: { kind: "number", label: "Shrink with distance", min: 0, max: 1, step: 0.01, group: "essentials" },
  speed: { kind: "number", label: "Speed", min: 0, max: 2000, step: 10, unit: "ms", group: "essentials" },

  // --- camera ---
  pitch: { kind: "number", label: "Pitch", min: -85, max: 85, step: 1, unit: "°", centred: true, group: "camera" },
  distance: { kind: "number", label: "Lens distance", min: 300, max: 4000, step: 10, unit: "px", hint: "The lens. Short is a dramatic wide angle, long is a flat telephoto.", group: "camera" },
  // Framing, kept separate from Lens distance on purpose. That one is the lens —
  // move it and the perspective changes character. This just fills more or less
  // of the frame with the same picture, which is what you want when an
  // arrangement is cropped tighter than you meant or has run off the edges.
  zoom: { kind: "number", label: "Zoom", min: 0.25, max: 3, step: 0.05, unit: "×", hint: "Fills more of the frame with the same picture — the perspective is untouched.", group: "camera" },
  // Reaches a quarter turn either way, because rolling the track fully on end is
  // how Vertical column is made and every style has to be reachable by dragging
  // — a preset the sliders cannot express would break the one claim this tool
  // makes. Input follows the track at whatever angle this is set to.
  tilt: { kind: "number", label: "Diagonal tilt", min: -90, max: 90, step: 1, unit: "°", centred: true, hint: "Rolls the whole track, so the cards run across the screen at an angle.", group: "camera" },

  // --- arrangement ---
  arcRotation: { kind: "number", label: "Bowl → arch", min: -90, max: 90, step: 1, unit: "°", centred: true, hint: "Negative bends the arc into the screen, positive stands it up the page.", group: "arrangement" },
  invert: { kind: "boolean", label: "Turn inside out", hint: "Puts you inside the ring: the focused card sits furthest away.", group: "arrangement" },
  rings: { kind: "rings", label: "Rings", group: "arrangement" },
  // Numerals rather than "One / Two / Three", to match Rings directly above —
  // the same shape of choice should read the same way, and three words do not
  // fit the control's width without truncating to "O… T… T…".
  //
  // Rows and rings are the two independent axes of the arrangement, and the
  // pair sitting together is what makes that legible: rings are copies of the
  // whole thing at wider radii, rows split one set into bands stacked on the
  // same surface. Depth tunnel is two rows of one ring; add a ring and you get
  // a second two-row tunnel outside the first.
  bandRows: {
    kind: "segment",
    label: "Rows",
    options: [
      { value: "1", label: "1" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
    ],
    hint: "Wraps the set into bands stacked on the same surface, rather than one long row.",
    group: "arrangement",
  },
  risePerTurn: { kind: "number", label: "Climb per turn", min: -600, max: 600, step: 10, unit: "px", centred: true, hint: "Makes the ring climb as it turns, into a helix.", group: "arrangement" },

  // --- the cards ---
  cardWidth: { kind: "number", label: "Width", min: 80, max: 600, step: 4, unit: "px", group: "cards" },
  cardAspect: { kind: "number", label: "Shape", min: 0.5, max: 2.5, step: 0.01, hint: "The height of a card against its width.", group: "cards" },
  cardRadius: { kind: "number", label: "Corner radius", min: 0, max: 80, step: 1, unit: "px", group: "cards" },
  transparency: { kind: "number", label: "See-through", min: 0, max: 1, step: 0.01, hint: "Makes cards glassy, so the ones behind show through.", group: "cards" },
  // Negative turns the cards *against* the curve, which fans them the opposite
  // way and reads as scattered rather than ordered. A look worth having, and one
  // dial rather than two.
  cardFacing: { kind: "number", label: "Cards follow the curve", min: -1, max: 1, step: 0.01, centred: true, hint: "Turns cards to follow the arc. Negative fans them against it.", group: "cards" },
  cardUpright: { kind: "number", label: "Keep cards upright", min: 0, max: 1, step: 0.01, hint: "Cancels the diagonal roll card by card, so the track leans and they do not.", group: "cards" },

  // --- distance effects ---
  blurFalloff: { kind: "number", label: "Blur with distance", min: 0, max: 12, step: 0.25, unit: "px", group: "distance" },
  fadeFalloff: { kind: "number", label: "Fade with distance", min: 0, max: 0.5, step: 0.01, group: "distance" },
  sizeGradient: { kind: "number", label: "Size sweep", min: -1, max: 1, step: 0.02, centred: true, hint: "Grows cards steadily one way round the ring and shrinks them the other.", group: "distance" },

  // --- randomness ---
  jitter: { kind: "number", label: "Scatter", min: 0, max: 1, step: 0.01, hint: "Nudges and tilts each card a little, from a fixed random seed.", group: "randomness" },
  sizeJitter: { kind: "number", label: "Size variation", min: 0, max: 1, step: 0.01, hint: "Varies the card sizes, so the row reads as hand-laid.", group: "randomness" },

  // --- card content ---
  // A carousel of pictures that go nowhere is a screensaver. Cards can carry a
  // title, a caption, a button and a link, and show them when they matter.
  cardReveal: {
    kind: "enum",
    label: "Show content",
    options: [
      { value: "never", label: "Never" },
      { value: "focus", label: "Centred" },
      { value: "hover", label: "Hover" },
      { value: "both", label: "Both" },
    ],
    group: "content",
  },
  // Sits directly under "Show content" because it is the same question asked
  // twice: that one decides when a card *says* anything, this one decides when
  // saying it makes the card clickable. The default ties them together, which is
  // the honest arrangement — a picture with nothing on it should not take you
  // off the page when you touch it.
  cardLink: {
    kind: "enum",
    label: "Cards link",
    options: [
      { value: "never", label: "Never" },
      { value: "content", label: "With content" },
      { value: "always", label: "Always" },
    ],
    hint: "With content, a card only goes anywhere while its words and button are showing.",
    group: "content",
  },
  contentLayout: {
    kind: "enum",
    label: "Layout",
    options: [
      { value: "panel", label: "Text panel" },
      { value: "button", label: "Button only" },
    ],
    group: "content",
  },
  revealZoom: { kind: "number", label: "Zoom on reveal", min: 1, max: 1.3, step: 0.01, unit: "×", hint: "The picture inside the card grows, not the card itself.", group: "content" },
  // Both of these are taste, not rescue. The whole content block already shrinks
  // with the card, so the words keep their share of the picture instead of
  // spilling over the edge — see TUNED_CARD in the controller. These two move it
  // either side of that, and share a range so the pair read as a pair.
  buttonScale: { kind: "number", label: "Button size", min: 0.7, max: 2, step: 0.05, unit: "×", group: "content" },
  textScale: { kind: "number", label: "Text size", min: 0.7, max: 2, step: 0.05, unit: "×", hint: "The title and caption. They already shrink with the card; this is on top.", group: "content" },

  // --- movement ---
  easing: {
    kind: "enum",
    label: "Easing",
    options: [
      { value: "settle", label: "Settle" },
      { value: "snap", label: "Snap" },
      { value: "glide", label: "Glide" },
      { value: "overshoot", label: "Overshoot" },
    ],
    group: "movement",
  },
  autoplay: { kind: "boolean", label: "Autoplay", group: "movement" },
  autoplayInterval: { kind: "number", label: "Autoplay gap", min: 800, max: 10000, step: 100, unit: "ms", group: "movement" },
  pauseOnHover: { kind: "boolean", label: "Pause on hover", group: "movement" },

  // --- what visitors can do ---
  drag: { kind: "boolean", label: "Drag", group: "controls" },
  dragWeight: { kind: "number", label: "Flick momentum", min: 0, max: 3, step: 0.05, unit: "×", hint: "How far a flick carries after you let go.", group: "controls" },
  wheel: { kind: "boolean", label: "Mouse wheel", group: "controls" },
  arrows: { kind: "boolean", label: "Arrows", group: "controls" },
  dots: { kind: "boolean", label: "Dots", group: "controls" },
  tapToFocus: { kind: "boolean", label: "Tap to centre", group: "controls" },
  loop: { kind: "boolean", label: "Loop", group: "controls" },
  snap: { kind: "boolean", label: "Snap to centre", group: "controls" },
};
