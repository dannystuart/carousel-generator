import { DEG } from "./geometry";
import type { CarouselParams } from "./types";

/**
 * Why a control currently does nothing, or null if it does something.
 *
 * Some dials genuinely stop mattering at some settings of other dials. Depth
 * multiplies how far the curve recedes, so with no curve there is nothing to
 * multiply; the camera has nothing to project at a flat arrangement; an autoplay
 * interval means nothing with autoplay off. A slider that moves while the
 * picture does not reads as a broken tool, so the editor greys these out and
 * shows the reason rather than letting the visitor wonder.
 *
 * This is the alternative to giving Depth a second, independent job — decided
 * with Danny on 10 Aug 2026 by looking at it. Keeping the parameter model honest
 * costs one sentence of interface; the other way costs a slider that means two
 * different things depending on a slider somewhere else, and a Prompt output
 * that has to explain both.
 *
 * Every reason here has to be *true*: a test moves each parameter the full width
 * of its range and fails if the engine's output shifts anywhere.
 */
/** True where nothing at all separates the cards front-to-back. */
function hasNoDepth(p: CarouselParams): boolean {
  // Bend the arc fully into the screen plane and it has no depth left, however
  // hard it curves — the whole ring lies in the picture.
  return p.curve === 0 || p.depth === 0 || Math.abs(Math.cos(p.arcRotation * DEG)) < 1e-9;
}

export function inertReason(key: keyof CarouselParams, p: CarouselParams): string | null {
  const flatTrack = p.curve === 0;
  const inScreenPlane = Math.abs(Math.cos(p.arcRotation * DEG)) < 1e-9;

  switch (key) {
    case "depth":
      return flatTrack ? "Depth deepens the curve, and Curve is at zero." : null;

    case "arcRotation":
      return flatTrack ? "There is no bend to rotate while Curve is at zero." : null;

    case "cardFacing":
      return flatTrack ? "Cards can only follow a curve while Curve is above zero." : null;

    case "risePerTurn":
      return flatTrack ? "Nothing climbs while Curve is at zero." : null;

    case "invert":
      return flatTrack ? "There is nothing to turn inside out while Curve is at zero." : null;

    case "distance":
      if (flatTrack) return "Nothing sits at any depth while Curve is at zero.";
      if (p.depth === 0) return "Nothing sits at any depth while Depth is at zero.";
      if (inScreenPlane) return "Arc rotation has laid the curve flat in the screen.";
      return null;

    case "cardUpright":
      return p.tilt === 0 ? "Diagonal tilt is at zero, so there is no roll to resist." : null;

    case "autoplayInterval":
    case "pauseOnHover":
      return p.autoplay ? null : "Autoplay is off.";

    case "dragWeight":
      return p.drag ? null : "Drag is off.";

    case "revealZoom":
    case "contentLayout":
    case "buttonScale":
      return p.cardReveal === "never" ? "Card content is set to never show." : null;

    // The button-only layout takes the title and caption off screen, so a dial
    // that sizes them has nothing left to size.
    case "textScale":
      if (p.cardReveal === "never") return "Card content is set to never show.";
      return p.contentLayout === "button" ? "The button-only layout hides the words." : null;

    default:
      return null;
  }
}

/**
 * A note about a control that is working, but cannot do the whole of its job at
 * these settings. The opposite case to `inertReason`: that one is for a control
 * doing nothing at all, and the editor takes it away. This one leaves it alone
 * and says what to expect, because the control is still the one you want.
 *
 * One so far. Card angle turns the cards, and that much always happens — what it
 * cannot do without depth is *stack* them. Every card sits at the same distance
 * from the eye, and turning one swings its edges forward and back by half its
 * width times the sine of the angle: 150px either way on a 320px card at 90°.
 * So it passes clean through its neighbours. Chrome draws the intersection,
 * Safari picks a whole card to put in front, and both are right — the shape is
 * self-intersecting, and no amount of stacking work can rescue it. It is why
 * every style that ships with no depth ships with Card angle at zero.
 */
export function cautionReason(key: keyof CarouselParams, p: CarouselParams): string | null {
  if (key !== "cardAngle" || p.cardAngle === 0 || !hasNoDepth(p)) return null;

  // Only worth mentioning once neighbouring cards actually meet on screen: a
  // widely spaced fan turns as far as you like without ever touching, and a note
  // about a problem the picture does not have is worse than no note. Half a
  // card, plus half a turned card, against the gap between their centres — and
  // measured on the widest a card gets, since size variation is what tipped Flat
  // fan over. Deliberately generous: this decides when to speak, not what is
  // true, and the cost of speaking a little early is one greyed line of type.
  const widest = (p.cardWidth / 2) * (1 + 0.55 * p.sizeJitter);
  const meets = p.spacing < widest * (1 + Math.cos(p.cardAngle * DEG));
  if (!meets) return null;

  return "Nothing separates the cards in depth, so turned ones cut into each other. Add some Curve or Depth.";
}
