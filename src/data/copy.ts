/**
 * Every search-facing string in the app, in one place.
 *
 * The rule this file exists for: **no search-facing copy inline in a component,
 * ever.** Page title, meta description, headings, social card and structured
 * data all read from here, so they cannot drift apart — and the port onto
 * vanta.supply is a swap of this file rather than a hunt through the markup.
 * Anything a search engine or a share preview can see belongs here. Button
 * labels and slider names do not; they are interface, not copy.
 *
 * Source: the spec's §11 table, verbatim, with its character counts.
 */
export const COPY = {
  /** 49 / 60. "Website" carries the searches; "3D" carries the spoken name. */
  title: "Website Carousel Generator — 3D Carousel Examples",

  /** 156 / 160. */
  description:
    "Build a 3D carousel with sliders — angle, depth, curve and camera. Copy clean code or an AI prompt. Free, no signup. Coverflow, orbit rings, helix and more.",

  h1: "3D carousel generator",

  /** Where "carousel for your website" appears in visible copy, not just the title. */
  subheading: "Build a carousel for your website with sliders. Copy the code, or the prompt.",

  /** Each style's own page, once those exist. `{style}` is the style's name. */
  stylePageTitle: "{style} Carousel — 3D Example You Can Copy",

  /**
   * Placeholder words on the demo cards, so the card-content reveal has
   * something to reveal. Obvious filler on purpose: it is what someone replaces
   * first, and it must never read as a real brand's copy.
   */
  sampleCard: {
    title: "Card title",
    caption: "A line about this one.",
    cta: "View",
    /**
     * example.com is reserved by the IANA for exactly this, so it can never
     * become somebody's real site — and it reads as a placeholder at a glance,
     * which an empty string does not. It opens in a new tab, so trying the
     * button never costs you your place in the tool.
     */
    href: "https://example.com",
  },

  /** Written from the finished card at public/social-card.png, by looking at it. */
  socialCardAlt:
    "A coverflow of photographs curving into the distance, beside a panel of sliders labelled Curve, Card angle and Depth.",
} as const;
