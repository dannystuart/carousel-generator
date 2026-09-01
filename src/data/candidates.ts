import type { CarouselParams } from "@/engine/types";

/**
 * Candidates for the styles that ship, most traced to a reference in
 * `Carousel Inspiration/`. This file is the input to a decision, not a
 * deliverable — the ones that survive get tuned and locked in engine/presets.ts.
 *
 * `cards` is here because a ring style has a natural card count: twenty-five
 * images spread over a 180° arch is a crowd, and the references that use rings
 * use twelve to twenty. It is a property of the style, not of the image set.
 */
export interface Candidate {
  slug: string;
  name: string;
  oneLiner: string;
  /** Which reference in `Carousel Inspiration/` this is aiming at. */
  reference: string;
  /** How many of the prepared images this style wants on screen. */
  cards: number;
  /** Some of these only read properly against black. */
  background: "light" | "dark";
  /** Where this one stands in the choice of ten. */
  status: "in" | "pending" | "out";
  params: Partial<CarouselParams>;
}

export const CANDIDATES: Candidate[] = [
  {
    slug: "vertical-column",
    name: "Vertical column",
    oneLiner: "A column of cards you scroll down through, curving away as it goes.",
    reference: "new — the vertical one",
    cards: 12,
    background: "light",
    status: "in",
    params: {
      // Rolling the track a quarter turn stands it on end; keeping the cards
      // upright against that roll leaves them straight. Dragging, the wheel and
      // the up/down keys all follow the track, so this reads as scrolling.
      tilt: 90, cardUpright: 1, curve: 0.3, cardAngle: 0, cardFacing: 0,
      spacing: 116, cardWidth: 236, cardAspect: 0.66, cardRadius: 14,
      sizeFalloff: 0.26, blurFalloff: 1.6, fadeFalloff: 0.26,
      distance: 1300, speed: 620, arrows: false,
    },
  },
  {
    slug: "canopy",
    name: "Canopy",
    oneLiner: "Big cards arcing overhead, seen from below — you stand under it.",
    reference: "new — reworked from Wide arc",
    cards: 9,
    background: "light",
    status: "out",
    params: {
      // Nothing else in the set is seen from below; every other pitch looks down.
      curve: 0.34, arcRotation: 52, pitch: -24, cardFacing: 0.55, cardAngle: 0,
      spacing: 176, cardWidth: 196, cardAspect: 1.2, cardRadius: 16,
      sizeFalloff: 0.14, fadeFalloff: 0.07, distance: 1100, speed: 660,
    },
  },
  {
    slug: "wide-angle-bow",
    name: "Wide-angle bow",
    oneLiner: "One enormous card, its neighbours sweeping away past your ears.",
    reference: "new — reworked from Wide arc",
    cards: 9,
    background: "light",
    status: "out",
    params: {
      // The drama is all in the camera: 620px of perspective on 260px cards is a
      // very wide lens, so the focused card looms and the rest fall away hard.
      curve: 0.3, cardAngle: 32, cardFacing: 0.2,
      spacing: 208, cardWidth: 252, cardAspect: 1.28, cardRadius: 16,
      sizeFalloff: 0.2, fadeFalloff: 0.1, blurFalloff: 1.2, distance: 620, speed: 660,
    },
  },
  {
    slug: "grand-arch",
    name: "Grand arch",
    oneLiner: "Five huge cards bending up over the page like a doorway.",
    reference: "new — reworked from Wide arc",
    cards: 7,
    background: "dark",
    status: "out",
    params: {
      // The fanned arch with a handful of big cards instead of a crowd of small
      // ones — same shape, completely different picture.
      curve: 0.66, arcRotation: 90, cardFacing: 1, cardAngle: 0,
      spacing: 150, cardWidth: 158, cardAspect: 1.24, cardRadius: 18,
      sizeFalloff: 0.1, fadeFalloff: 0.06, distance: 1500, speed: 660,
    },
  },
  {
    slug: "coverflow",
    name: "Coverflow",
    oneLiner: "Shallow curve, strong card angle — the one everybody knows.",
    reference: "the classic",
    cards: 14,
    background: "light",
    status: "in",
    params: {
      curve: 0.16, cardAngle: 54, depth: 1, spacing: 140, sizeFalloff: 0.26, speed: 620,
      distance: 1150, cardWidth: 186, cardAspect: 1.3, cardRadius: 12, fadeFalloff: 0.1,
    },
  },
  {
    slug: "orbit-ring",
    name: "Orbit ring",
    oneLiner: "A closed ring lying in the screen, cards turning with it.",
    reference: "Inkwell — Awwwards SOTD",
    cards: 22,
    background: "light",
    status: "out",
    params: {
      curve: 1, arcRotation: 90, cardFacing: 1, cardAngle: 0,
      spacing: 55, cardWidth: 46, cardAspect: 1.34, cardRadius: 3,
      sizeFalloff: 0, fadeFalloff: 0, distance: 2600, speed: 700, arrows: false,
    },
  },
  {
    slug: "tilted-orbit",
    name: "Tilted orbit",
    oneLiner: "The same ring laid flat, camera looking down on it.",
    reference: "_ (39)",
    cards: 24,
    background: "light",
    status: "out",
    params: {
      curve: 1, arcRotation: 0, pitch: 34, cardFacing: 1, cardAngle: 0,
      spacing: 62, cardWidth: 66, cardAspect: 1.28, cardRadius: 4,
      sizeFalloff: 0, fadeFalloff: 0, distance: 1900, speed: 700, arrows: false,
    },
  },
  {
    slug: "dual-orbit",
    name: "Dual orbit",
    oneLiner: "Two rings at different radii, turning opposite ways.",
    reference: "apple_watch_watch_face_dual_orbit",
    cards: 18,
    background: "light",
    status: "in",
    params: {
      curve: 1, arcRotation: 90, cardFacing: 1, cardAngle: 0,
      rings: [{ scale: 1, drift: 0.32 }, { scale: 1.7, drift: -0.32 }],
      spacing: 33, cardWidth: 40, cardAspect: 1.3, cardRadius: 4,
      sizeFalloff: 0, fadeFalloff: 0, snap: false, distance: 2600, arrows: false,
    },
  },
  {
    slug: "ribbon-cylinder",
    name: "Ribbon cylinder",
    oneLiner: "A ring turned on its side, two rows deep — a band of images.",
    reference: "CLOU Architects",
    cards: 26,
    background: "light",
    status: "out",
    params: {
      curve: 1, arcRotation: 0, pitch: 30, bandRows: 2, cardFacing: 1, cardAngle: 0,
      spacing: 96, cardWidth: 98, cardAspect: 1, cardRadius: 0,
      sizeFalloff: 0, fadeFalloff: 0, distance: 1700, speed: 720, arrows: false,
    },
  },
  {
    slug: "concave-arc",
    name: "Concave arc",
    oneLiner: "Inverted, so you stand inside the curve and it wraps toward you.",
    reference: "_ (40)",
    cards: 7,
    background: "light",
    status: "in",
    params: {
      // Standing inside the ring, the outer cards are physically nearer the
      // camera, so perspective alone should make them markedly bigger. Size
      // falloff is off because it was fighting that, and depth plus a close
      // camera is what turns a gentle bow into "I am inside this".
      curve: 0.42, invert: true, depth: 3, cardFacing: 1, cardAngle: 0,
      spacing: 52, cardWidth: 66, cardAspect: 1.32, cardRadius: 8,
      sizeFalloff: 0, fadeFalloff: 0.03, distance: 420, speed: 640,
    },
  },
  {
    slug: "diagonal-descent",
    name: "Diagonal descent",
    oneLiner: "A straight track rolled over, so cards climb across the screen.",
    reference: "screenshot_iphone_16_pro_features_display",
    cards: 16,
    background: "light",
    status: "in",
    params: {
      // The path runs diagonally, the cards stay straight — cardUpright cancels
      // the scene's roll per card. Falloffs are matched to carousel-standalone,
      // where a neighbour sits at 0.7 scale, 0.7 opacity and 2px of blur.
      curve: 0, tilt: -20, cardUpright: 1, cardAngle: 18, cardFacing: 0,
      spacing: 168, cardWidth: 186, cardAspect: 1.3, cardRadius: 14,
      sizeFalloff: 0.43, blurFalloff: 2, fadeFalloff: 0.3,
      distance: 1500, speed: 640,
    },
  },
  {
    slug: "depth-tunnel",
    name: "Depth tunnel",
    oneLiner: "Inside a tube of pictures, the far ones dissolving into blur.",
    reference: "floating_photo_cards_interface",
    cards: 20,
    background: "dark",
    status: "in",
    params: {
      curve: 0.62, invert: true, depth: 1.35, cardFacing: 0.45, cardAngle: 0, bandRows: 2,
      blurFalloff: 2.4, fadeFalloff: 0.1, sizeFalloff: 0.2,
      spacing: 116, cardWidth: 122, cardAspect: 1.3, cardRadius: 14,
      distance: 900, speed: 660, arrows: false,
    },
  },
  {
    slug: "fanned-arch",
    name: "Fanned arch",
    oneLiner: "An arch of cards bending up over the middle of the page.",
    reference: "Pin by 航天 杨 — Gather",
    cards: 13,
    background: "dark",
    status: "in",
    params: {
      curve: 0.52, arcRotation: 90, cardFacing: 1, cardAngle: 0,
      spacing: 66, cardWidth: 62, cardAspect: 1, cardRadius: 18,
      sizeFalloff: 0.02, fadeFalloff: 0.02, distance: 2600, speed: 620, arrows: false,
    },
  },
  {
    slug: "helix",
    name: "Helix",
    oneLiner: "A ring that climbs as it turns — a spiral staircase of images.",
    reference: "new",
    cards: 24,
    background: "light",
    status: "in",
    params: {
      curve: 1, risePerTurn: 260, pitch: 28, cardFacing: 1, cardAngle: 0,
      spacing: 48, cardWidth: 52, cardAspect: 1.3, cardRadius: 6,
      sizeFalloff: 0, fadeFalloff: 0, distance: 1900, speed: 720, arrows: false,
    },
  },
  {
    slug: "vortex",
    name: "Vortex",
    oneLiner: "A ring where the cards swell one way round, tiny to enormous.",
    reference: "music_album_art_push_oh_sattel",
    cards: 18,
    background: "light",
    status: "in",
    params: {
      curve: 1, arcRotation: 90, cardFacing: 0, cardAngle: 0, sizeGradient: 0.62,
      spacing: 46, cardWidth: 54, cardAspect: 1.16, cardRadius: 4,
      sizeFalloff: 0, fadeFalloff: 0, distance: 2600, speed: 700, arrows: false,
    },
  },
  {
    slug: "cylinder-marquee",
    name: "Cylinder marquee",
    oneLiner: "A ring seen almost edge-on, turning forever on its own.",
    reference: "CLOU Architects, moving",
    cards: 24,
    background: "light",
    status: "in",
    params: {
      // Edge to edge, not overlapping. Cards face along the ring, so each pair is
      // tangent at a slightly different angle — make one wider than the straight
      // line between their centres and the two physically intersect, which is
      // what made the seams look broken. That chord is spacing x sin(t/2)/(t/2),
      // so at 24 cards the card must stay under 99.7% of the spacing. Square
      // corners too: rounded ones leave little diamond gaps at every join.
      curve: 1, arcRotation: 0, pitch: 10, cardFacing: 1, cardAngle: 0,
      rings: [{ scale: 1, drift: 0.45 }],
      spacing: 68, cardWidth: 67, cardAspect: 1.15, cardRadius: 0,
      sizeFalloff: 0, fadeFalloff: 0, snap: false, distance: 1900, arrows: false,
    },
  },
  {
    slug: "flat-fan",
    name: "Flat fan",
    oneLiner: "No curve, no depth — just cards laid out as if by hand.",
    reference: "_ (41) — listen($)",
    cards: 16,
    background: "light",
    status: "in",
    params: {
      curve: 0, depth: 0, cardAngle: 0, cardFacing: 0, jitter: 0.5, sizeJitter: 0.9,
      spacing: 132, cardWidth: 120, cardAspect: 1.2, cardRadius: 10,
      sizeFalloff: 0.05, fadeFalloff: 0.03, distance: 3200, speed: 600,
    },
  },
  {
    slug: "peek-stack",
    name: "Peek stack",
    oneLiner: "A deck, with just an edge of each card showing behind the last.",
    reference: "new",
    cards: 20,
    background: "light",
    status: "in",
    params: {
      // The cards were 0.5px apart in depth while yawed 8 degrees, so each one's
      // near edge swung ~7px in FRONT of the card before it and poked through.
      // Card angle off removes the intersection; curve and depth give the deck
      // real separation instead of leaving it nearly coplanar. The slight fan
      // comes from jitter's in-plane rotation, which cannot intersect anything.
      curve: 0.45, depth: 3, cardAngle: 0, jitter: 0.18,
      spacing: 30, sizeFalloff: 0.42, fadeFalloff: 0.08,
      cardWidth: 196, cardAspect: 1.34, cardRadius: 18, distance: 1700, speed: 600,
    },
  },
  {
    slug: "wide-arc",
    name: "Wide arc",
    oneLiner: "A gentle bow of large cards, barely turned at all.",
    reference: "_ (41)",
    cards: 12,
    background: "light",
    status: "out",
    params: {
      cardAngle: 0, cardFacing: 0,
      curve: 0.24, spacing: 126, cardWidth: 134, cardAspect: 1.3, cardRadius: 12,
      sizeFalloff: 0.11, fadeFalloff: 0.07, distance: 2000, speed: 640,
    },
  },
];
