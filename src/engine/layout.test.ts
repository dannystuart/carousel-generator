import { describe, it, expect } from "vitest";
import { arrangementCentre, cardsPerRow, defaultRingScale, visibleRange, wrappedOffset } from "./layout";
import { DEFAULT_PARAMS, PARAM_META } from "./defaults";
import { cardVisual } from "./geometry";
import { PRESETS, presetParams } from "./presets";
import type { CarouselParams } from "./types";

const P = (over: Partial<CarouselParams> = {}): CarouselParams => ({ ...DEFAULT_PARAMS, ...over });

describe("wrappedOffset", () => {
  it("is zero for the focused card", () => {
    expect(wrappedOffset(5, 5, 12, true)).toBe(0);
    expect(wrappedOffset(5, 5, 12, false)).toBe(0);
  });

  it("picks the short way round when looping", () => {
    // Position sits on card 11. Card 0 is one step ahead, not eleven behind.
    expect(wrappedOffset(0, 11, 12, true)).toBeCloseTo(1, 9);
    // And the other way: card 11 is one step behind position 0.
    expect(wrappedOffset(11, 0, 12, true)).toBeCloseTo(-1, 9);
  });

  it("never returns more than half a ring when looping", () => {
    for (let index = 0; index < 12; index++) {
      expect(Math.abs(wrappedOffset(index, 0, 12, true))).toBeLessThanOrEqual(6);
    }
  });

  it("takes the long way when looping is off", () => {
    expect(wrappedOffset(0, 11, 12, false)).toBeCloseTo(-11, 9);
    expect(wrappedOffset(11, 0, 12, false)).toBeCloseTo(11, 9);
  });

  it("handles a fractional position mid-tween", () => {
    expect(wrappedOffset(0, 11.5, 12, true)).toBeCloseTo(0.5, 9);
    expect(wrappedOffset(3, 2.25, 12, true)).toBeCloseTo(0.75, 9);
  });

  it("stays continuous as the position walks across the seam", () => {
    let previous = wrappedOffset(0, 11, 12, true);
    for (let position = 11.1; position <= 12.9; position += 0.1) {
      const d = wrappedOffset(0, position, 12, true);
      expect(Math.abs(d - previous), `at ${position.toFixed(1)}`).toBeLessThan(0.2);
      previous = d;
    }
  });
});

describe("visibleRange", () => {
  it("renders every card on a closed ring with nothing culling it", () => {
    // A closed ring has no off-screen to cull to — the far side curves back
    // into view — so the only reason to drop a card is fade or size.
    const range = visibleRange(P({ curve: 1, fadeFalloff: 0, sizeFalloff: 0 }), 24);
    expect(range).toBeGreaterThanOrEqual(12);
  });

  it("stays bounded on a straight track with 500 cards", () => {
    expect(visibleRange(P({ curve: 0 }), 500)).toBeLessThan(30);
    // …and still bounded with every falloff switched off.
    expect(visibleRange(P({ curve: 0, fadeFalloff: 0, sizeFalloff: 0 }), 500)).toBeLessThanOrEqual(30);
  });

  it("stops where the fade reaches zero", () => {
    // opacity = 1 − 0.2n hits zero at n = 5, so card 6 contributes nothing.
    expect(visibleRange(P({ fadeFalloff: 0.2, sizeFalloff: 0 }), 500)).toBe(5);
  });

  it("stops where cards shrink to a speck", () => {
    // scale = 1/(1+n) drops under 4% of full size by n = 24.
    expect(visibleRange(P({ fadeFalloff: 0, sizeFalloff: 1 }), 500)).toBeLessThanOrEqual(24);
    expect(visibleRange(P({ fadeFalloff: 0, sizeFalloff: 1 }), 500)).toBeGreaterThan(10);
  });

  it("never exceeds what wrappedOffset can return", () => {
    expect(visibleRange(P({ curve: 1, fadeFalloff: 0, sizeFalloff: 0 }), 12)).toBeLessThanOrEqual(6);
    expect(visibleRange(P({ loop: false, fadeFalloff: 0, sizeFalloff: 0 }), 8)).toBeLessThanOrEqual(8);
  });

  it("is at least one, so something always renders", () => {
    expect(visibleRange(P({ fadeFalloff: 0.5, sizeFalloff: 1 }), 3)).toBeGreaterThanOrEqual(1);
  });
});

const arrangementOffsetY = (...args: Parameters<typeof arrangementCentre>) =>
  arrangementCentre(...args).y;

describe("arrangementCentre — the y slide", () => {
  it("leaves a flat track and a bowl exactly where they are", () => {
    expect(arrangementOffsetY(P({ curve: 0 }), 12, 6)).toBeCloseTo(0, 9);
    expect(arrangementOffsetY(P({ curve: 0.6, arcRotation: 0 }), 12, 6)).toBeCloseTo(0, 9);
  });

  it("centres a ring that bends up the screen instead of letting it run off the edge", () => {
    // At arcRotation 90 the focused card is at the top of the arch and the ring
    // hangs 2R below it, so without this the bottom half is off-screen at any
    // useful radius. The correction lifts it by one radius.
    const params = P({ curve: 1, arcRotation: 90, spacing: 100, depth: 1 });
    const radius = 100 / ((Math.PI * 2) / 12);
    expect(arrangementOffsetY(params, 12, 6)).toBeCloseTo(-radius, 3);
  });

  it("centres a two-row band on the band, not on its top row", () => {
    const params = P({ curve: 0, bandRows: 2, cardWidth: 200, cardAspect: 1 });
    // Row 1 sits one card-height plus a hair below row 0.
    expect(arrangementOffsetY(params, 12, 4)).toBeCloseTo(-(200 * 1.04) / 2, 3);
  });

  it("centres a three-row band on its middle row", () => {
    // Rows at 0, h and 2h, so the middle of the band is exactly one row down —
    // and the arrangement has to be lifted by that much, not by half of it.
    const params = P({ curve: 0, bandRows: 3, cardWidth: 200, cardAspect: 1 });
    expect(arrangementOffsetY(params, 12, 4)).toBeCloseTo(-(200 * 1.04), 3);
  });

  it("leaves a helix alone, because it already climbs evenly either side", () => {
    // Equal numbers of cards rise above and fall below the focused one, so the
    // climb is already centred and there is nothing to correct.
    expect(arrangementOffsetY(P({ curve: 1, risePerTurn: 400 }), 12, 6)).toBeCloseTo(0, 6);
    expect(arrangementOffsetY(P({ curve: 1, risePerTurn: -400 }), 12, 6)).toBeCloseTo(0, 6);
  });

  it("does correct a helix that also bends up the screen", () => {
    const offset = arrangementOffsetY(P({ curve: 1, risePerTurn: 400, arcRotation: 60 }), 12, 6);
    expect(Math.abs(offset)).toBeGreaterThan(1);
  });

  it("ignores jitter, so the composition does not depend on the dice", () => {
    const withJitter = arrangementOffsetY(P({ curve: 1, arcRotation: 90, jitter: 1 }), 12, 6);
    const without = arrangementOffsetY(P({ curve: 1, arcRotation: 90, jitter: 0 }), 12, 6);
    expect(withJitter).toBeCloseTo(without, 9);
  });

  it("does not move when a second ring is added around the first", () => {
    // Concentric means one centre, so adding a bigger ring around it cannot
    // shift where the middle is. If this ever changes, the rings have stopped
    // being concentric.
    const one = arrangementOffsetY(P({ curve: 1, arcRotation: 90, rings: [{ scale: 1, drift: 0 }] }), 12, 6);
    const two = arrangementOffsetY(
      P({ curve: 1, arcRotation: 90, rings: [{ scale: 1, drift: 0 }, { scale: 2, drift: 0 }] }),
      12,
      6,
    );
    expect(two).toBeCloseTo(one, 6);
  });

  it("never returns NaN for a degenerate arrangement", () => {
    expect(arrangementOffsetY(P({ curve: 1, arcRotation: 90 }), 0, 1)).toBe(0);
    expect(Number.isFinite(arrangementOffsetY(P({ rings: [] }), 12, 6))).toBe(true);
  });
});

/**
 * Half way between the highest and lowest card, in screen pixels, once the
 * browser has finished with them. Zero means the arrangement is framed.
 *
 * This is the DOM's own chain, not a re-derivation of it: the root carries
 * `perspective(distance)`, and the stage carries
 * `translateY(slide) rotateX(pitch) rotateZ(tilt)` about a transform origin
 * pushed back to the arrangement's mid-depth. The rightmost transform applies
 * to the point first, and the perspective divide applies to the result.
 */
function frameMidpoint(params: CarouselParams, count: number, range: number): number {
  const { y: slide, z: pivot } = arrangementCentre(params, count, range);
  const pitch = (params.pitch * Math.PI) / 180;
  const tilt = (params.tilt * Math.PI) / 180;
  const distance = params.distance;

  let lowest = Infinity;
  let highest = -Infinity;
  for (let offset = -range; offset <= range; offset++) {
    const v = cardVisual(params, offset, 0, count);
    const y1 = v.x * Math.sin(tilt) + v.y * Math.cos(tilt);
    const zc = v.z - pivot;
    const y2 = y1 * Math.cos(pitch) - zc * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + zc * Math.cos(pitch) + pivot;
    const screenY = ((y2 + slide) * distance) / (distance - z2);
    lowest = Math.min(lowest, screenY);
    highest = Math.max(highest, screenY);
  }
  return (lowest + highest) / 2;
}

describe("arrangementCentre — framing", () => {
  it("does not sample further round than the cards can actually reach", () => {
    // Seven looping cards can only ever be 3.5 steps from the focused one, so
    // measuring the arc out to offset 4 overstates how tall the arrangement is
    // and lifts it clean out of the middle of the frame.
    const params = P({ curve: 0.46, arcRotation: 90, spacing: 168, fadeFalloff: 0.06 });
    const honest = arrangementCentre(params, 7, 3).y;
    const overreached = arrangementCentre(params, 7, 8).y;
    expect(overreached).toBeCloseTo(honest, 6);
  });

  it("still uses the whole window when the window is the smaller of the two", () => {
    const params = P({ curve: 0.46, arcRotation: 90, spacing: 168 });
    const narrow = arrangementCentre(params, 40, 3).y;
    const wide = arrangementCentre(params, 40, 8).y;
    expect(Math.abs(wide)).toBeGreaterThan(Math.abs(narrow));
  });

  it("centres what the camera sees, not what the arrangement measures", () => {
    // The stage does rotateX(pitch) rotateZ(tilt) translateY(y), so the slide has
    // to be solved through those rotations or a pitched scene sits off-centre.
    // A tenth of a pixel, not nothing: the cards are drawn with the paint-order
    // sliver and the slide is solved without it, deliberately — see `stacked` in
    // cardVisual. Anything that actually mis-frames a scene moves it by tens of
    // pixels, which this still catches.
    const params = P({ curve: 0.4, arcRotation: 52, pitch: -24, tilt: 0, spacing: 176 });
    expect(Math.abs(frameMidpoint(params, 9, 4))).toBeLessThan(0.25);
  });

  it("centres a pitched ring through the perspective divide, not before it", () => {
    // Pitch is what puts depth into the vertical measurement, and depth is
    // exactly what the camera's divide then compresses. Measuring the shape and
    // stopping there leaves the far half nearer the middle than the maths thinks
    // — which hung the helix 200px above its box and the marquee 80px above its.
    const marquee = P({ curve: 1, pitch: 10, cardFacing: 1, spacing: 116, distance: 3200 });
    const helix = P({ curve: 1, pitch: 38, risePerTurn: 320, cardFacing: 1, spacing: 86, distance: 3000 });
    expect(frameMidpoint(marquee, 24, 12), "marquee").toBeCloseTo(0, 3);
    expect(frameMidpoint(helix, 24, 12), "helix").toBeCloseTo(0, 3);
  });

  it("slides a fully vertical track vertically, not sideways", () => {
    // At tilt 90 the arrangement's x becomes screen y. A slide computed in
    // arrangement space would have pushed the whole thing sideways instead.
    const flat = arrangementCentre(P({ curve: 0, tilt: 90 }), 12, 5).y;
    expect(flat).toBeCloseTo(0, 6);
    const arch = arrangementCentre(P({ curve: 0.5, arcRotation: 90, tilt: 90 }), 12, 5).y;
    expect(Number.isFinite(arch)).toBe(true);
  });

  it("leaves an unpitched scene exactly where it was", () => {
    const params = P({ curve: 1, arcRotation: 90, spacing: 100 });
    const radius = 100 / ((Math.PI * 2) / 12);
    expect(arrangementCentre(params, 12, 6).y).toBeCloseTo(-radius, 3);
  });
});

describe("arrangementCentre — the z pivot", () => {
  it("is zero on a flat track, which has no depth to pivot about", () => {
    expect(arrangementCentre(P({ curve: 0 }), 12, 6).z).toBeCloseTo(0, 6);
  });

  it("sits half way into a bowl, so a pitch tips the ring on the spot", () => {
    // A closed ring recedes from 0 to -2R, so its middle is one radius in.
    const params = P({ curve: 1, spacing: 100 });
    const radius = 100 / ((Math.PI * 2) / 12);
    expect(arrangementCentre(params, 12, 6).z).toBeCloseTo(-radius, 2);
  });

  it("is zero for a ring lying in the screen plane, which has no depth", () => {
    expect(arrangementCentre(P({ curve: 1, arcRotation: 90 }), 12, 6).z).toBeCloseTo(0, 4);
  });

  it("follows an inverted arc back toward the viewer", () => {
    const bowl = arrangementCentre(P({ curve: 1 }), 12, 6).z;
    const inside = arrangementCentre(P({ curve: 1, invert: true }), 12, 6).z;
    expect(bowl).toBeLessThan(-1);
    expect(inside).toBeCloseTo(-bowl, 4);
  });
});

/**
 * A ring's size is a multiple of the arrangement's own radius, and that radius
 * has nothing to do with how big the style looks: a barely-curved arrangement is
 * a shallow slice of an enormous circle. So a fixed multiplier means something
 * different on every style — which is how "add a ring" on Coverflow produced one
 * card four times the width of the frame.
 */
describe("defaultRingScale", () => {
  it("leaves the base ring alone", () => {
    expect(defaultRingScale(P({ curve: 0.5 }), 0, 12)).toBe(1);
  });

  it("steps further out for each ring beyond the first", () => {
    const p = P({ curve: 1, spacing: 120, cardWidth: 100 });
    const [one, two] = [defaultRingScale(p, 1, 12), defaultRingScale(p, 2, 12)];
    expect(one).toBeGreaterThan(1);
    expect(two).toBeGreaterThan(one);
  });

  it("stays inside the slider's own range", () => {
    for (const p of [P({ curve: 0.001, spacing: 600 }), P({ curve: 1, spacing: 40, cardWidth: 600 })]) {
      const scale = defaultRingScale(p, 2, 12);
      expect(scale).toBeGreaterThanOrEqual(0.4);
      expect(scale).toBeLessThanOrEqual(3);
    }
  });

  // The reported bug, as a number: on every style that ships, the ring this
  // hands back has to leave the outer set behind the camera. The old fixed 1.7x
  // put Coverflow's hard against it, where perspective blows a card up without
  // limit.
  it("never pushes a ring into the camera, on any of the twelve", () => {
    for (const preset of PRESETS) {
      const p = presetParams(preset.slug);
      const perRow = cardsPerRow(p, preset.cards);
      const scale = defaultRingScale(p, 1, perRow);
      const range = visibleRange(p, perRow);
      const limit = p.distance * 0.82;
      for (let i = 0; i < perRow; i++) {
        const offset = wrappedOffset(i, 0, perRow, p.loop);
        if (Math.abs(offset) > range) continue;
        const { z } = cardVisual(p, offset, i, perRow, scale, 0, range);
        expect(z, `${preset.slug} card ${i}`).toBeLessThan(limit);
      }
    }
  });

  it("takes a smaller step where depth has already spread the rings apart", () => {
    const shallow = P({ curve: 0.5, depth: 1, spacing: 120, cardWidth: 200 });
    const deep = { ...shallow, depth: 3 };
    expect(defaultRingScale(deep, 1, 12)).toBeLessThan(defaultRingScale(shallow, 1, 12));
  });
});

/**
 * Rows and rings are the arrangement's two independent axes, and it is worth
 * pinning that they stay independent: a ring is another whole copy of the
 * arrangement at a wider radius, a row is the same set split into bands stacked
 * on one surface. Depth tunnel is two rows of one ring, so adding a ring there
 * gives a second two-row tunnel outside the first rather than a third row.
 */
describe("splitting a set into rows", () => {
  it("gives every row an equal share, rounding up", () => {
    const rows = (count: number, bandRows: number) => cardsPerRow(P({ bandRows }), count);
    expect(rows(20, 1)).toBe(20);
    expect(rows(20, 2)).toBe(10);
    expect(rows(24, 3)).toBe(8);
  });

  /**
   * The ring size is the same for every row, so a set that does not divide by
   * the row count leaves the last row short — one empty slot in a closed ring,
   * which shows as a gap that turns past with the rest. Twenty cards over three
   * rows is 7, 7 and 6. Worth stating as a fact rather than discovering it in a
   * screenshot: it is the one thing a third row can cost.
   */
  it("leaves the last row short when the set does not divide evenly", () => {
    const perRow = cardsPerRow(P({ bandRows: 3 }), 20);
    expect(perRow).toBe(7);
    const filled = [0, 1, 2].map((row) => Math.min(perRow, Math.max(0, 20 - row * perRow)));
    expect(filled).toEqual([7, 7, 6]);

    // Twenty-four divides by one, two and three alike, and leaves no gap.
    const clean = cardsPerRow(P({ bandRows: 3 }), 24);
    expect([0, 1, 2].map((row) => Math.min(clean, Math.max(0, 24 - row * clean)))).toEqual([8, 8, 8]);
  });

  it("offers every row count the engine can actually lay out", () => {
    const meta = PARAM_META.bandRows;
    if (meta.kind !== "segment") throw new Error("Rows should be a segment control");
    for (const option of meta.options) {
      const count = Number(option.value);
      expect(Number.isInteger(count) && count >= 1, option.value).toBe(true);
      // Every offered value has to split a real set into that many non-empty
      // rows, or the control is offering something that does not happen.
      const perRow = cardsPerRow(P({ bandRows: count }), 24);
      expect(Math.ceil(24 / perRow), option.label).toBe(count);
    }
  });
});
