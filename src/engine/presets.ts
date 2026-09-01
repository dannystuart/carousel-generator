import { DEFAULT_PARAMS } from "./defaults";
import type { CarouselParams } from "./types";

/**
 * The twelve styles that ship.
 *
 * Each one is a position on the same set of dials — there is no per-style code
 * anywhere in the engine, and there must never be. They were chosen from a live
 * catalogue of sixteen candidates (see docs/plans/style-selection-2026-08-10.md)
 * and every number here was set by holding the style against its reference image
 * at full size, not by reasoning about it.
 *
 * "Full size" means the editor's preview box, 1040×640 — see
 * `src/components/previewStage.ts`. The numbers are absolute pixels, so they are
 * tuned to that box and the editor has to build to it.
 *
 * Only what differs from DEFAULT_PARAMS is listed, because the copied snippet
 * prints exactly this object and a preset restating a default is noise in
 * somebody else's codebase. That includes parameters a style makes *inert*: a
 * ring lying flat in the screen has no depth for the camera to work on, so
 * naming a perspective distance on one would be a number that does nothing.
 *
 * `cards` is part of the style, not of the image set: twenty-five images spread
 * over a 180° arch is a crowd, and a ring that closes wants a number that suits
 * its radius. The Prompt output has to state it, so it lives here.
 */
export interface Preset {
  /** URL segment for this style's own page. */
  slug: string;
  name: string;
  oneLiner: string;
  /** Which reference in `Carousel Inspiration/` this was tuned against. */
  reference: string;
  /** How many cards this style wants on screen. */
  cards: number;
  /** Some of these only read against black. */
  background: "light" | "dark";
  params: Partial<CarouselParams>;
}

export const PRESETS: Preset[] = [
  {
    slug: "coverflow",
    name: "Coverflow",
    oneLiner: "Shallow curve, strong card angle — the one everybody knows.",
    reference: "the classic",
    cards: 14,
    background: "light",
    params: {
      curve: 0.16, cardAngle: 54, spacing: 216, sizeFalloff: 0.26, fadeFalloff: 0.1,
      cardWidth: 288, cardAspect: 1.3, cardRadius: 18, distance: 1800,
    },
  },
  {
    slug: "dual-orbit",
    name: "Dual orbit",
    oneLiner: "Two rings at different radii, turning opposite ways.",
    reference: "apple_watch_watch_face_dual_orbit",
    cards: 12,
    background: "light",
    params: {
      // Flat in the screen plane, so there is no depth and the camera distance
      // would be an inert number in the copied snippet. Left off deliberately.
      // The card has to stay narrower than the spacing or the ring's own cards
      // overlap each other and the two rings read as one crowd; fourteen at this
      // radius leaves a gap between every pair, which is what the reference has.
      // The outer ring is deliberately taller than the frame, as the reference's
      // is: the inner one reads whole, the outer one runs off the top and bottom.
      curve: 1, arcRotation: 90, cardFacing: 1, cardAngle: 0,
      rings: [{ scale: 1, drift: 0.32 }, { scale: 2, drift: -0.32 }],
      spacing: 116, cardWidth: 84, cardAspect: 1.3, cardRadius: 8,
      sizeFalloff: 0, fadeFalloff: 0, snap: false, arrows: false,
    },
  },
  {
    slug: "concave-arc",
    name: "Concave arc",
    oneLiner: "Inverted, so you stand inside the curve and it wraps toward you.",
    reference: "_ (40)",
    cards: 7,
    background: "light",
    params: {
      // Standing inside the ring puts the outer cards physically nearer the
      // camera, so perspective alone makes them bigger and size falloff is off
      // because it fought that. The reference is restrained about it — a wall of
      // near-equal cards, gently wrapped — so the wide-angle lens the small
      // version leaned on is gone: a long lens and a shallower bend instead.
      curve: 0.27, invert: true, depth: 1.1, cardFacing: 1, cardAngle: 0,
      spacing: 224, cardWidth: 200, cardAspect: 1.45, cardRadius: 10,
      sizeFalloff: 0, fadeFalloff: 0.03, distance: 1500, speed: 640,
    },
  },
  {
    slug: "diagonal-descent",
    name: "Diagonal descent",
    oneLiner: "A straight track rolled over, so cards climb across the screen.",
    reference: "screenshot_iphone_16_pro_features_display",
    cards: 14,
    background: "light",
    params: {
      // The path runs diagonally, the cards stay straight — cardUpright cancels
      // the scene's roll per card. Card size, spacing and all three falloffs are
      // carousel-standalone's exactly: 340×430 cards on a 280px step, and a
      // neighbour at 0.7 scale, 0.7 opacity, 2px of blur. The diagonal is
      // steeper than its 8°, which barely reads as a diagonal at this width.
      // Nothing has depth here, so the camera distance is left off.
      curve: 0, tilt: -18, cardUpright: 1, cardAngle: 0,
      spacing: 280, cardWidth: 340, cardAspect: 1.27, cardRadius: 18,
      sizeFalloff: 0.43, blurFalloff: 2, fadeFalloff: 0.3, speed: 640,
    },
  },
  {
    slug: "depth-tunnel",
    name: "Depth tunnel",
    oneLiner: "Inside a tube of pictures, the far ones dissolving into blur.",
    reference: "floating_photo_cards_interface",
    cards: 20,
    background: "dark",
    params: {
      // Two rows wrapped round a tube that recedes *away* — the reference is the
      // mouth of the tunnel, not the middle of it, so the side cards go back and
      // turn their inner faces toward you rather than swinging past your ears.
      // A close camera does most of the work; size falloff only helps it along,
      // and the fade takes the far ones to black before they get small enough to
      // look like litter.
      curve: 0.7, depth: 1.6, cardFacing: 0.75, cardAngle: 0, bandRows: 2,
      blurFalloff: 2.8, fadeFalloff: 0.16, sizeFalloff: 0.1,
      spacing: 190, cardWidth: 200, cardAspect: 1.3, cardRadius: 16,
      distance: 1100, speed: 660, arrows: false,
    },
  },
  {
    slug: "fanned-arch",
    name: "Fanned arch",
    oneLiner: "An arch of cards bending up over the middle of the page.",
    reference: "Pin by 航天 杨 — Gather",
    cards: 13,
    background: "dark",
    params: {
      // Arc rotation at 90° stands the bend up in the screen plane: the focused
      // card at the apex, the rest hanging away down both sides. Flat, so no
      // camera distance — the arch is drawn, not projected.
      curve: 0.52, arcRotation: 90, cardFacing: 1, cardAngle: 0,
      spacing: 128, cardWidth: 118, cardAspect: 1, cardRadius: 34,
      sizeFalloff: 0.02, fadeFalloff: 0.02, arrows: false,
    },
  },
  {
    slug: "helix",
    name: "Helix",
    oneLiner: "A ring that climbs as it turns — a spiral staircase of images.",
    reference: "new",
    cards: 24,
    background: "light",
    params: {
      // Cards face along the ring, so the same chord rule as the marquee applies
      // — wider than the straight line between neighbouring centres and they cut
      // into each other. At 24 cards that line is 99.7% of the spacing.
      curve: 1, risePerTurn: 320, pitch: 38, cardFacing: 1, cardAngle: 0,
      spacing: 86, cardWidth: 84, cardAspect: 1.3, cardRadius: 10,
      sizeFalloff: 0, fadeFalloff: 0, distance: 3000, speed: 720, arrows: false,
    },
  },
  {
    slug: "vortex",
    name: "Vortex",
    oneLiner: "A ring where the cards swell one way round, tiny to enormous.",
    reference: "music_album_art_push_oh_sattel",
    cards: 18,
    background: "light",
    params: {
      // The size gradient runs one way round the ring, so the biggest cards
      // crowd and crop at one edge exactly as the reference does. Flat in the
      // screen plane, so no camera distance.
      curve: 1, arcRotation: 90, cardAngle: 0, sizeGradient: 0.82,
      spacing: 82, cardWidth: 108, cardAspect: 1.16, cardRadius: 8,
      sizeFalloff: 0, fadeFalloff: 0, speed: 700, arrows: false,
    },
  },
  {
    slug: "cylinder-marquee",
    name: "Cylinder marquee",
    oneLiner: "A ring seen almost edge-on, turning forever on its own.",
    reference: "CLOU Architects, moving",
    cards: 24,
    background: "light",
    params: {
      // Edge to edge, not overlapping. Cards face along the ring, so each pair is
      // tangent at a slightly different angle — make one wider than the straight
      // line between their centres and the two physically intersect, which is
      // what made the seams look broken. That chord is spacing x sin(t/2)/(t/2),
      // so at 24 cards the card must stay under 99.7% of the spacing. Square
      // corners too: rounded ones leave little diamond gaps at every join.
      curve: 1, pitch: 10, cardFacing: 1, cardAngle: 0,
      rings: [{ scale: 1, drift: 0.45 }],
      spacing: 116, cardWidth: 114, cardAspect: 1.15, cardRadius: 0,
      sizeFalloff: 0, fadeFalloff: 0, snap: false, distance: 3200, arrows: false,
    },
  },
  {
    slug: "flat-fan",
    name: "Flat fan",
    oneLiner: "No curve, no depth — just cards laid out as if by hand.",
    reference: "_ (41) — listen($)",
    cards: 16,
    background: "light",
    params: {
      // Depth off and curve flat, so every card sits in the same plane and the
      // hand-laid look comes entirely from the two jitters — position and tilt
      // from one, size from the other. Nothing to project, so no distance.
      curve: 0, depth: 0, cardAngle: 0, jitter: 0.5, sizeJitter: 0.9,
      spacing: 186, cardWidth: 170, cardAspect: 1.2, cardRadius: 10,
      sizeFalloff: 0.05, fadeFalloff: 0.03, speed: 600,
    },
  },
  {
    slug: "peek-stack",
    name: "Peek stack",
    oneLiner: "A deck, with just an edge of each card showing behind the last.",
    reference: "new",
    cards: 20,
    background: "light",
    params: {
      // The cards were 0.5px apart in depth while yawed 8 degrees, so each one's
      // near edge swung ~7px in FRONT of the card before it and poked through.
      // Card angle off removes the intersection; curve and depth give the deck
      // real separation instead of leaving it nearly coplanar. The slight fan
      // comes from jitter's in-plane rotation, which cannot intersect anything.
      curve: 0.45, depth: 3, cardAngle: 0, jitter: 0.18,
      spacing: 44, sizeFalloff: 0.42, fadeFalloff: 0.08,
      cardWidth: 300, cardAspect: 1.34, cardRadius: 26, distance: 2600, speed: 600,
    },
  },
  {
    slug: "vertical-column",
    name: "Vertical column",
    oneLiner: "A column of cards you scroll down through, curving away as it goes.",
    reference: "new — the vertical one",
    cards: 12,
    background: "light",
    params: {
      // Rolling the track a quarter turn stands it on end; keeping the cards
      // upright against that roll leaves them straight. Dragging, the wheel and
      // the up/down keys all follow the track, so this reads as scrolling. The
      // column runs off the top and bottom of the box on purpose — its host does
      // the clipping, because neither the root nor the stage may clip themselves
      // without flattening the 3D.
      tilt: 90, cardUpright: 1, curve: 0.3, cardAngle: 0,
      spacing: 176, cardWidth: 260, cardAspect: 0.62,
      sizeFalloff: 0.24, blurFalloff: 1.4, fadeFalloff: 0.24,
      distance: 1300, arrows: false,
    },
  },
];

export function presetBySlug(slug: string): Preset | undefined {
  return PRESETS.find((preset) => preset.slug === slug);
}

/** A preset's parameters with every unstated one filled in from the defaults. */
export function presetParams(slug: string): CarouselParams {
  const preset = presetBySlug(slug);
  if (!preset) throw new Error(`presetParams: no style called "${slug}"`);
  return { ...DEFAULT_PARAMS, ...preset.params };
}
