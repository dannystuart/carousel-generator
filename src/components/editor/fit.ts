/** What the arrangement occupies, in stage pixels, with the Zoom dial divided out. */
export interface Extent {
  width: number;
  height: number;
}

export interface Frame {
  width: number;
  height: number;
}

/** How much of the frame the arrangement is allowed to fill. */
const MARGIN = 0.94;

/**
 * How far below the old fixed framing the fit may pull an arrangement.
 *
 * Some of the twelve are bounded shapes — a ring, an arch, a helix — and they
 * want the whole of themselves on screen; a fifth smaller is enough to get any
 * of them there. The rest are strips. A coverflow is fourteen cards on a line,
 * seventeen hundred pixels of it; a flat fan is three thousand. There is no
 * framing that shows all of a strip *and* fills a screen with it, and the strip
 * was always meant to run off the edge — so past a fifth the fit stops trying
 * and lets it crop, which is the composition those styles were tuned for.
 */
const FLOOR = 0.8;

/**
 * How much more elongated than the window an arrangement has to be before it
 * counts as a strip, and the floor above applies to it at all.
 *
 * The floor exists to stop a coverflow being shrunk into thumbnails, and it must
 * not do anything else. Tied to the window alone it does: on a large monitor the
 * floor rises with the screen, and a ring that would have fitted perfectly well
 * gets held too large and cut off at the top and bottom again. So the question
 * is not how big the window is, it is whether this arrangement is a strip — and
 * a shape within touching distance of the window's own proportions never is.
 */
const ELONGATED = 2;

/**
 * The most the picture may be blown up, whatever the fit asks for.
 *
 * Absolute rather than relative to the window, because this is not about
 * arithmetic: the pictures are a fixed size, and a peek stack magnified to fill
 * a large screen is a soft peek stack. Better a small arrangement that sits in
 * some space than a sharp idea rendered blurry.
 *
 * In practice the tuned-size cap below binds first on any ordinary window; this
 * only takes over on a monitor big enough that even the tuned size goes soft.
 */
const CEILING = 1.8;

/**
 * How much of the picture a card has to be worth before the framing counts it.
 *
 * Not opacity alone. A card can be perfectly opaque and still be scenery: a
 * coverflow's far cards are a third the size of the focused one and trail off
 * for hundreds of pixels. So a card is weighed by how much of the picture it
 * occupies — its area against the largest card's, times how solid it is.
 */
export const VISIBLE = 0.1;

/** One card's claim on the picture: how big it is drawn, times how solid. */
export function weight(area: number, largest: number, opacity: number): number {
  if (largest <= 0) return 0;
  return (area / largest) * opacity;
}

/** The old framing: fit the nominal box the twelve were tuned against. */
export function boxScale(frame: Frame, box: Frame): number {
  if (box.width <= 0 || box.height <= 0) return 1;
  return Math.min(frame.width / box.width, frame.height / box.height);
}

/**
 * How much to scale the stage, given what the arrangement actually occupies.
 *
 * The twelve are tuned in absolute pixels against a 1040×640 box, and they do
 * not share a shape: a vertical column is tall and narrow, a cylinder marquee is
 * wide and flat, a peek stack is barely larger than one card. One fixed frame
 * flatters some of them and slices the rest — which a full-screen scene made
 * obvious, seven of the twelve gaining from the room and three left cut against
 * the edge. So the frame is fitted to each arrangement, between a floor and a
 * ceiling that each exist for their own reason above.
 *
 * Zoom is deliberately not part of this. It is divided out of the extent before
 * fitting and lands back on top afterwards, so a fitted arrangement is what you
 * get at Zoom 1 and the dial still means "and now a bit closer". Fold zoom into
 * the fit and it cancels itself out, leaving a slider that moves and does
 * nothing.
 */
export function stageScale(extent: Extent | null, frame: Frame, box: Frame): number {
  const base = boxScale(frame, box);
  if (!extent || extent.width <= 0 || extent.height <= 0) return base;
  if (frame.width <= 0 || frame.height <= 0) return base;

  const fitted = Math.min(
    (frame.width * MARGIN) / extent.width,
    (frame.height * MARGIN) / extent.height,
  );

  const elongation = extent.width / extent.height / (frame.width / frame.height);
  const isStrip = elongation > ELONGATED || elongation < 1 / ELONGATED;
  const floor = isStrip ? base * FLOOR : 0;

  // The fit may shrink an arrangement so the whole of it is on screen, and
  // that is all it may do. Never above `base` — the size the twelve were tuned
  // at — because filling the window is not the composition anybody designed.
  // Diagonal descent fades its neighbours so hard that only three cards count
  // as visible, and "zoom until three cards fill the screen" put a 340px card
  // on screen at 450: not a bigger picture, a different one. Growth capped at
  // the tuned size, the styles that fit their box arrive exactly as designed
  // and the oversized shapes still pull back until they fit.
  return Math.min(base, CEILING, Math.max(floor, fitted));
}
