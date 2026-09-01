export type Easing = "settle" | "snap" | "glide" | "overshoot";

/**
 * When a card's own content — its title, caption and button — is shown.
 *
 * "never" is the default, because a carousel of photographs with nothing to say
 * should stay a carousel of photographs. The content is always in the markup
 * either way: it is a screen reader's only route to what a card is, and hiding
 * it by not rendering it would take that away.
 */
export type CardReveal = "never" | "focus" | "hover" | "both";

/**
 * How a revealing card lays its content out: the text panel along the bottom
 * edge, or nothing but the button, centred on the card. Either way every piece
 * stays in the markup — the layout only decides what sighted eyes get.
 */
export type ContentLayout = "panel" | "button";

/**
 * When a card with a web address on it actually goes there.
 *
 * "content" is the default, and it is the only one of the three that is a rule
 * rather than a preference: a card shows nothing to say it is clickable until
 * its words and button are revealed, so until then it should not be clickable.
 * A picture that silently takes you off the page when you touch it is a trap,
 * and worse for anyone who cannot see it — under this setting a dormant card is
 * not a link in the markup either, so a screen reader and a crawler both meet
 * the picture it looks like.
 *
 * "always" is for the carousel that is a wall of links and nothing else — a logo
 * row, a gallery — where the pictures are the whole interface and there is no
 * text to reveal. "never" leaves the addresses in the markup for later.
 */
export type CardLink = "never" | "content" | "always";

export interface RingSpec {
  /** Radius multiplier relative to the base arc. 1 = the base ring. */
  scale: number;
  /** Cards per second of drift. Negative turns the other way. 0 = no drift. */
  drift: number;
}

export interface CarouselParams {
  // --- the six that do the most work ---
  /** 0 = straight track, 1 = closed ring. */
  curve: number;
  /** Degrees each card turns away from the viewer, sign following its side. */
  cardAngle: number;
  /** Multiplier on how far the arc recedes in z. */
  depth: number;
  /** Arc length in px between card centres. */
  spacing: number;
  /** How quickly cards shrink with distance from centre. */
  sizeFalloff: number;
  /** Milliseconds for one card move. */
  speed: number;

  // --- camera ---
  /** Degrees the scene is pitched, so you look down on the arrangement. */
  pitch: number;
  /** CSS perspective in px. Small = dramatic wide angle, large = flat telephoto. */
  distance: number;
  /**
   * How much of the frame the arrangement fills. A true zoom, not a dolly: the
   * whole picture grows or shrinks and the composition is untouched, so it
   * cannot be had by moving `distance`, which changes the perspective instead.
   */
  zoom: number;
  /** Degrees the whole track is rolled, so cards descend across the screen. */
  tilt: number;

  // --- shape ---
  /** Focused card sits furthest away instead of nearest — you are inside the ring. */
  invert: boolean;
  /** 0 = the arc bends into the screen (bowl), 90 = it bends up the screen (arch). */
  arcRotation: number;
  /** One, two or three concentric rings. */
  rings: RingSpec[];
  /** One row, or two wrapped around the surface. */
  bandRows: number;
  /** Px the arrangement climbs per full turn — the helix. */
  risePerTurn: number;

  // --- look ---
  /** Px of blur added per step from centre, measured on screen. */
  blurFalloff: number;
  /** Opacity lost per step from centre. */
  fadeFalloff: number;
  /** -1..1. Non-zero grows cards one way round the ring — the vortex. */
  sizeGradient: number;
  /** 0 = cards always face you, 1 = cards follow the curve. */
  cardFacing: number;
  /** 0..1 of slight random tilt and offset, seeded so it never changes. */
  jitter: number;
  /** 0..1 of random size variation per card, seeded. Eclectic rather than uniform. */
  sizeJitter: number;
  /**
   * 0..1 of how much cards stay upright against the scene's roll. At 1 the track
   * runs diagonally but every card is straight; at 0 the cards roll with it.
   */
  cardUpright: number;
  cardWidth: number;
  /** Height ÷ width. */
  cardAspect: number;
  cardRadius: number;
  /** 0 = solid, 1 = glassy and overlapping. */
  transparency: number;
  /** When a card shows its own title, caption and button. */
  cardReveal: CardReveal;
  /** When a card carrying a web address actually follows it. */
  cardLink: CardLink;
  /**
   * How much the picture inside a revealing card grows. 1 = not at all.
   *
   * Deliberately the *picture* and not the card: growing the card swings its
   * edges out of its own plane, and cards on a ring are already close enough to
   * their neighbours to cut into them. See the coplanar-cards note in
   * docs/web-build-gotchas.md.
   */
  revealZoom: number;
  /** The bottom text panel, or just the button centred on the card. */
  contentLayout: ContentLayout;
  /** How large the button is drawn, relative to its usual size. */
  buttonScale: number;
  /**
   * How large the title and caption are drawn, relative to their usual size.
   *
   * Taste only. The words already shrink with the card on their own — see the
   * tuned card in the controller — so this is for making them smaller or larger
   * than that, not for stopping them overflowing.
   */
  textScale: number;

  // --- feel ---
  easing: Easing;

  // --- interaction ---
  drag: boolean;
  /** Momentum multiplier on flick release. */
  dragWeight: number;
  arrows: boolean;
  dots: boolean;
  autoplay: boolean;
  autoplayInterval: number;
  pauseOnHover: boolean;
  wheel: boolean;
  /** Tapping a card brings it to the centre. A tap, not the end of a drag. */
  tapToFocus: boolean;
  loop: boolean;
  snap: boolean;
}

/** What the engine computes for one card, in the arrangement's own space. */
export interface CardVisual {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  /** Screen pixels of blur — already divided by scale, see the compositing note. */
  blur: number;
  opacity: number;
  /**
   * The order to draw this card in, for the browsers that will not work it out
   * from the depth. Ranks identically to `z`; see Z_INDEX_ORIGIN in geometry.
   */
  zIndex: number;
}
