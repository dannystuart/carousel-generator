import { describe, it, expect } from "vitest";
import { arcPoint, arcRadius, cardVisual } from "./geometry";
import { DEFAULT_PARAMS } from "./defaults";
import type { CarouselParams } from "./types";

describe("arcPoint", () => {
  it("is a straight line at curve 0, with exact spacing", () => {
    const p = arcPoint({ offset: 3, curve: 0, spacing: 200, count: 12 });
    expect(p.x).toBeCloseTo(600, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it("closes into a ring at curve 1 — card N lands back on card 0", () => {
    const count = 12;
    const first = arcPoint({ offset: 0, curve: 1, spacing: 200, count });
    const wrapped = arcPoint({ offset: count, curve: 1, spacing: 200, count });
    expect(wrapped.x).toBeCloseTo(first.x, 6);
    expect(wrapped.z).toBeCloseTo(first.z, 6);
  });

  it("puts the focused card at the origin at every curve value", () => {
    for (const curve of [0, 0.01, 0.3, 0.7, 1]) {
      const p = arcPoint({ offset: 0, curve, spacing: 200, count: 12 });
      expect(p.x, `curve ${curve}`).toBeCloseTo(0, 9);
      expect(p.z, `curve ${curve}`).toBeCloseTo(0, 9);
    }
  });

  // The ladder starts at 0.005, not 0.05. Between those two the arc genuinely
  // un-bows by ~38px — z ≈ −spacing·offset²·step/2, so it is proportional to
  // curve — and that is the feature, not a discontinuity. What this test is for
  // is the FLAT_EPSILON branch: the ladder straddles it (1e-5 takes the arc
  // formula, 1e-8 takes the limit) so a mismatch between the two shows up as a
  // jump. Sampling 0.05 → 0.01 in one rung measured the arc opening out, which
  // is what every other test here already covers.
  it("converges continuously as curve approaches 0 — no NaN, no jump", () => {
    let previous = arcPoint({ offset: 4, curve: 0.005, spacing: 200, count: 12 });
    for (const curve of [0.002, 0.001, 1e-4, 1e-5, 1e-8, 0]) {
      const p = arcPoint({ offset: 4, curve, spacing: 200, count: 12 });
      expect(Number.isFinite(p.x) && Number.isFinite(p.z), `curve ${curve}`).toBe(true);
      expect(Math.abs(p.x - previous.x), `x jump at ${curve}`).toBeLessThan(5);
      expect(Math.abs(p.z - previous.z), `z jump at ${curve}`).toBeLessThan(5);
      previous = p;
    }
    expect(previous.x).toBeCloseTo(800, 3);
  });

  it("hands over to the limit case without a visible step", () => {
    const args = { offset: 4, spacing: 200, count: 12 };
    // Either side of FLAT_EPSILON — one goes through the arc formula, the other
    // through the straight-line limit. They must agree to well under a pixel.
    const lastArc = arcPoint({ ...args, curve: 1e-5 });
    const firstFlat = arcPoint({ ...args, curve: 1e-7 });
    expect(Math.abs(lastArc.x - firstFlat.x)).toBeLessThan(0.01);
    expect(Math.abs(lastArc.z - firstFlat.z)).toBeLessThan(0.01);
  });

  it("keeps arc length between neighbours equal to spacing at any curve", () => {
    for (const curve of [0, 0.2, 0.6, 1]) {
      const a = arcPoint({ offset: 0, curve, spacing: 200, count: 24 });
      const b = arcPoint({ offset: 1, curve, spacing: 200, count: 24 });
      const chord = Math.hypot(b.x - a.x, b.z - a.z);
      // Chord ≤ arc, and for 24 cards the difference is under 1%.
      expect(chord, `curve ${curve}`).toBeGreaterThan(198);
      expect(chord, `curve ${curve}`).toBeLessThanOrEqual(200.0001);
    }
  });
});

const P = (over: Partial<CarouselParams> = {}): CarouselParams => ({ ...DEFAULT_PARAMS, ...over });
const at = (offset: number, over: Partial<CarouselParams> = {}) =>
  cardVisual(P(over), offset, Math.round(offset), 12);

describe("cardVisual", () => {
  it("leaves the focused card untouched", () => {
    const c = at(0, { blurFalloff: 8, fadeFalloff: 0.3, sizeFalloff: 0.5, jitter: 0 });
    expect(c.scale).toBeCloseTo(1, 6);
    expect(c.blur).toBeCloseTo(0, 6);
    expect(c.opacity).toBeCloseTo(1, 6);
    expect(c.z).toBeCloseTo(0, 6);
  });

  it("never lets scale reach zero or go negative, however many cards deep", () => {
    for (const offset of [1, 5, 20, 200]) {
      expect(at(offset, { sizeFalloff: 1 }).scale).toBeGreaterThan(0);
    }
  });

  it("compensates blur for the card's own scale, so blur is in screen pixels", () => {
    const c = at(2, { blurFalloff: 4, sizeFalloff: 0.5 });
    // 2 steps × 4px = 8px wanted on screen; the card is drawn at `scale`, and
    // filter resolves before the ancestor transform, so the value must be pre-divided.
    expect(c.blur * c.scale).toBeCloseTo(8, 4);
  });

  it("mirrors card angle either side of centre", () => {
    const left = at(-1, { cardAngle: 50, cardFacing: 0 });
    const right = at(1, { cardAngle: 50, cardFacing: 0 });
    expect(left.rotY).toBeCloseTo(-right.rotY, 6);
    expect(Math.abs(left.rotY)).toBeGreaterThan(20);
  });

  it("faces cards along the curve when cardFacing is 1", () => {
    const c = at(1, { curve: 1, cardFacing: 1, cardAngle: 0 });
    expect(c.rotY).toBeCloseTo(360 / 12, 4);
  });

  it("bends into the screen at arcRotation 0 and up the screen at 90", () => {
    const bowl = at(3, { curve: 0.5, arcRotation: 0 });
    const arch = at(3, { curve: 0.5, arcRotation: 90 });
    expect(Math.abs(bowl.z)).toBeGreaterThan(10);
    expect(bowl.y).toBeCloseTo(0, 6);
    expect(Math.abs(arch.y)).toBeCloseTo(Math.abs(bowl.z), 4);
    // All but a sliver: the depth has moved into y, and what is left is the
    // 0.4% the cards are drawn with so they still have an order to be drawn in.
    expect(Math.abs(arch.z)).toBeLessThan(Math.abs(bowl.z) * 0.005);
    expect(cardVisual(P({ curve: 0.5, arcRotation: 90 }), 3, 3, 12, 1, 0, undefined, false).z)
      .toBeCloseTo(0, 6);
  });

  // The sliver is a hint about drawing order, not part of the shape, so it has
  // to be exactly nothing wherever the shape already has depth to be sorted by,
  // and it has to grow in only as that depth goes.
  it("adds no paint-order sliver to an arrangement that bends into the screen", () => {
    const bowl = P({ curve: 0.5, arcRotation: 0 });
    expect(cardVisual(bowl, 3, 3, 12).z).toBe(cardVisual(bowl, 3, 3, 12, 1, 0, undefined, false).z);

    let previous = 0;
    for (const arcRotation of [0, 30, 60, 90]) {
      const p = P({ curve: 0.5, arcRotation });
      const added = Math.abs(
        cardVisual(p, 3, 3, 12).z - cardVisual(p, 3, 3, 12, 1, 0, undefined, false).z,
      );
      expect(added, `arcRotation ${arcRotation}`).toBeGreaterThanOrEqual(previous);
      previous = added;
    }
  });

  // A flat ring is the whole reason the sliver exists: with nothing to sort by,
  // the browser paints in document order, so the card coming into focus slides
  // behind its neighbours and the stack visibly re-shuffles the moment a preset
  // change lands on arcRotation 90.
  it("leaves a ring in the screen plane with an order to be drawn in", () => {
    const flat = P({ curve: 1, arcRotation: 90, spacing: 100 });
    const depths = [0, 1, 2, 3, 4, 5, 6].map((offset) => cardVisual(flat, offset, offset, 12).z);
    expect(new Set(depths).size).toBe(depths.length);
    // The focused card in front, each one further round the ring behind the last.
    for (let i = 1; i < depths.length; i++) expect(depths[i]).toBeLessThan(depths[i - 1]);
    // And small enough that the camera cannot tell: a card 1400px away moving
    // two pixels nearer is a fifth of a percent of scale.
    expect(Math.max(...depths.map(Math.abs))).toBeLessThan(3);
  });

  it("flips the recession when inverted", () => {
    expect(at(3, { curve: 0.5, invert: true }).z).toBeCloseTo(-at(3, { curve: 0.5 }).z, 6);
  });

  it("gives the same jitter for the same card every single time", () => {
    const a = at(2, { jitter: 1 });
    const b = at(2, { jitter: 1 });
    expect(a.rotZ).toBe(b.rotZ);
    expect(a.x).toBe(b.x);
  });

  // Every ring must be a *circle* of its own radius about the shared centre —
  // never an ellipse — and the angular step is untouched, so an outer ring still
  // closes at curve 1 with the same card count.
  it("keeps every ring a circle about the shared centre", () => {
    const params = P({ curve: 0.5 });
    const radius = arcRadius(0.5, params.spacing, 12);
    for (const scale of [1, 1.5, 2]) {
      for (const offset of [0, 1, 3, 5]) {
        const v = cardVisual(params, offset, offset, 12, scale);
        // The shared centre sits one base radius into the screen.
        expect(Math.hypot(v.x, v.z + radius), `scale ${scale} offset ${offset}`).toBeCloseTo(
          radius * scale,
          4,
        );
      }
    }
  });

  // Five of the twelve references (Inkwell, Dual Orbit, Push/Sattel, Gather,
  // the YouTube ring) are rings lying in the screen plane, and their cards turn
  // *in* that plane rather than yawing around a vertical axis. So card facing
  // has to follow whichever way the arc actually bends.
  const ARCH = { curve: 1, cardFacing: 1, cardAngle: 0, arcRotation: 90 };

  it("yaws cards along a bowl but turns them in-plane along an arch", () => {
    const bowl = at(2, { curve: 1, cardFacing: 1, cardAngle: 0, arcRotation: 0 });
    expect(bowl.rotY).toBeCloseTo(2 * (360 / 12), 4);
    expect(bowl.rotZ).toBeCloseTo(0, 6);

    const arch = at(2, { curve: 1, cardFacing: 1, cardAngle: 0, arcRotation: 90 });
    expect(arch.rotY).toBeCloseTo(0, 6);
    expect(Math.abs(arch.rotZ)).toBeCloseTo(2 * (360 / 12), 4);
  });

  it("splits the facing between the two axes half way round", () => {
    const half = at(2, { curve: 1, cardFacing: 1, cardAngle: 0, arcRotation: 45 });
    const full = 2 * (360 / 12);
    expect(Math.hypot(half.rotY, half.rotZ)).toBeCloseTo(full, 4);
    expect(Math.abs(half.rotY)).toBeCloseTo(Math.abs(half.rotZ), 4);
  });

  it("turns an arch's cards the way the arc goes, not against it", () => {
    // A card following the circumference points its own top away from the
    // circle's centre. On an arch the centre sits below the apex, so a card's
    // lean is exactly its angle round the arc: upright at the top, leaning
    // clockwise down the right-hand side, anticlockwise down the left. Rolling
    // the other way is what makes a fan read as scattered instead of ordered.
    const step = 360 / 12;
    expect(at(0, ARCH).rotZ).toBeCloseTo(0, 6);
    expect(at(2, ARCH).rotZ).toBeCloseTo(2 * step, 4);
    expect(at(-2, ARCH).rotZ).toBeCloseTo(-2 * step, 4);
  });

  it("turns the cards against the curve when card facing goes negative", () => {
    // The scattered look is worth keeping — Danny asked for both — and it is the
    // same dial the other way rather than a second parameter. Negative on a bowl
    // yaws cards outward for the same reason.
    expect(at(2, { ...ARCH, cardFacing: -1 }).rotZ).toBeCloseTo(-at(2, ARCH).rotZ, 6);

    const bowl = { curve: 1, cardAngle: 0 };
    expect(at(2, { ...bowl, cardFacing: -1 }).rotY).toBeCloseTo(
      -at(2, { ...bowl, cardFacing: 1 }).rotY,
      6,
    );
  });

  it("leaves card angle on the yaw axis, whatever the arc does", () => {
    // Card angle is "turned away from the viewer" — that is a yaw, always.
    const arch = at(1, { curve: 1, cardFacing: 0, cardAngle: 50, arcRotation: 90 });
    expect(Math.abs(arch.rotY)).toBeGreaterThan(20);
    expect(arch.rotZ).toBeCloseTo(0, 6);
  });

  // The plan's convention: 0 = bowl, 90 = arch, -90 = valley. An arch puts the
  // focused card at the TOP with the outer cards hanging below it, which is the
  // Gather reference; a valley is the other way up.
  it("puts the focused card at the top of an arch and the bottom of a valley", () => {
    const arch = at(4, { curve: 0.5, arcRotation: 90 });
    const valley = at(4, { curve: 0.5, arcRotation: -90 });
    // CSS y grows downward, so an outer card hanging below centre is y > 0.
    expect(arch.y).toBeGreaterThan(10);
    expect(valley.y).toBeLessThan(-10);
    expect(at(0, { curve: 0.5, arcRotation: 90 }).y).toBeCloseTo(0, 6);
  });

  it("keeps concentric rings concentric", () => {
    // Two rings must share a centre, not merely touch at the focused card:
    // the Dual Orbit reference is unmistakably one centre, two radii.
    const centreOf = (ringScale: number) => {
      const near = cardVisual(P({ curve: 1 }), 0, 0, 12, ringScale);
      const far = cardVisual(P({ curve: 1 }), 6, 6, 12, ringScale);
      return { z: (near.z + far.z) / 2, radius: Math.abs(far.z - near.z) / 2 };
    };
    const inner = centreOf(1);
    const outer = centreOf(2);
    expect(outer.z).toBeCloseTo(inner.z, 4);
    expect(outer.radius).toBeCloseTo(inner.radius * 2, 4);
  });

  it("pins only the base ring to the origin", () => {
    const params = P({ curve: 1 });
    const radius = arcRadius(1, params.spacing, 12);
    expect(cardVisual(params, 0, 0, 12, 1).z).toBeCloseTo(0, 6);
    // Sharing a centre means an outer ring's nearest card reaches past the base
    // ring by the difference in radii, rather than sitting on top of it.
    expect(cardVisual(params, 0, 0, 12, 2).z).toBeCloseTo(radius, 4);
  });

  // Danny, on the diagonal descent: "they're coming down diagonally, but the
  // actual cards are straight". The scene's roll carries the *path* diagonal;
  // this decides whether the cards go with it.
  it("keeps cards upright against the scene's roll when asked", () => {
    const rolling = at(2, { tilt: -28, cardUpright: 0 });
    expect(rolling.rotZ).toBeCloseTo(0, 6);

    // The stage rolls by `tilt`, so a card cancelling it turns the other way by
    // exactly as much — leaving the position rotated and the card straight.
    const upright = at(2, { tilt: -28, cardUpright: 1 });
    expect(upright.rotZ).toBeCloseTo(28, 6);

    const half = at(2, { tilt: -28, cardUpright: 0.5 });
    expect(half.rotZ).toBeCloseTo(14, 6);
  });

  it("varies card size eclectically, and repeatably", () => {
    const scales = new Set<number>();
    for (let index = 0; index < 12; index++) {
      scales.add(cardVisual(P({ sizeJitter: 1, sizeFalloff: 0 }), 0, index, 12).scale);
    }
    // Twelve cards, twelve different sizes — not one repeated value.
    expect(scales.size).toBe(12);
    // Some bigger than standard, some smaller.
    expect(Math.min(...scales)).toBeLessThan(0.85);
    expect(Math.max(...scales)).toBeGreaterThan(1.15);
    // Same card, same size, every time.
    expect(cardVisual(P({ sizeJitter: 1 }), 0, 5, 12).scale).toBe(
      cardVisual(P({ sizeJitter: 1 }), 0, 5, 12).scale,
    );
  });

  it("leaves size alone when size variation is off", () => {
    for (let index = 0; index < 6; index++) {
      expect(cardVisual(P({ sizeJitter: 0, sizeFalloff: 0 }), 0, index, 12).scale).toBeCloseTo(1, 9);
    }
  });

  // Danny, on the helix: "the images kind of just disappear out as they reach
  // the end. They should maybe fade out so it looks a bit cleaner."
  it("fades cards out at the edge of the window rather than popping them", () => {
    const range = 8;
    const edge = cardVisual(P({ fadeFalloff: 0, curve: 0 }), 8, 8, 40, 1, 0, range);
    const nearEdge = cardVisual(P({ fadeFalloff: 0, curve: 0 }), 7.4, 7, 40, 1, 0, range);
    const inside = cardVisual(P({ fadeFalloff: 0, curve: 0 }), 4, 4, 40, 1, 0, range);
    expect(edge.opacity).toBeCloseTo(0, 6);
    expect(nearEdge.opacity).toBeGreaterThan(0);
    expect(nearEdge.opacity).toBeLessThan(1);
    expect(inside.opacity).toBeCloseTo(1, 6);
  });

  it("does not fade the far side of a ring that closes on itself", () => {
    // Card +6 and card -6 of a twelve-card ring are the same card. There is no
    // edge to fade, and fading there would gut Inkwell and Dual Orbit.
    const far = cardVisual(P({ fadeFalloff: 0, curve: 1, cardAngle: 0 }), 6, 6, 12, 1, 0, 6);
    expect(far.opacity).toBeCloseTo(1, 6);
  });

  it("does fade the ends of a flat strip, which only counts as closed by its cards", () => {
    // Sixteen looping cards on a straight track: card +8 and card -8 wrap in
    // the arithmetic but sit at opposite ends of the strip on screen. Unfaded,
    // the end card crossed the whole strip in one frame on every travel.
    const end = cardVisual(P({ fadeFalloff: 0, curve: 0, cardAngle: 0 }), 8, 8, 16, 1, 0, 8);
    expect(end.opacity).toBeCloseTo(0, 6);
  });

  it("does fade the seam of a vortex, where a huge card meets a tiny one", () => {
    // The ring closes but the size does not: card +half is enormous and card
    // -half is a speck, sitting side by side. Without a fade they pop.
    const seam = cardVisual(P({ fadeFalloff: 0, curve: 1, sizeGradient: 0.6 }), 9, 9, 18, 1, 0, 9);
    expect(seam.opacity).toBeCloseTo(0, 6);
  });

  // Danny, on the cylinder marquee morphing into the flat fan: "flickering
  // transparency on the edges where it's joining other cards." Cards whose
  // facing unwinds during a morph sweep through edge-on, and the hidden back
  // made that a pop. A card leaves through a fade, not through a pop.
  it("fades a card out through edge-on instead of popping at the backface flip", () => {
    // curve 1, 4 cards, cardFacing 1: offset 1 sits a quarter-turn round, at
    // exactly 90° of yaw — edge-on to the viewer.
    const edgeOn = cardVisual(P({ curve: 1, cardFacing: 1, cardAngle: 0, fadeFalloff: 0 }), 1, 1, 4);
    expect(edgeOn.opacity).toBeCloseTo(0, 6);

    // A whisker before edge-on: fading, but not gone.
    const nearly = cardVisual(P({ curve: 1, cardFacing: 1, cardAngle: 0, fadeFalloff: 0 }), 0.94, 1, 4);
    expect(nearly.opacity).toBeGreaterThan(0);
    expect(nearly.opacity).toBeLessThan(1);

    // A coverflow's 54° lean is nowhere near the window — exactly as tuned.
    const coverflow = cardVisual(P({ cardAngle: 54, fadeFalloff: 0 }), -3, 3, 12);
    expect(coverflow.opacity).toBeCloseTo(1, 6);
  });

  it("does fade the seam of a helix, which never closes", () => {
    // The ring closes but the height does not, so card +12 sits a whole turn
    // above card -12 and the wrap is a visible jump without this.
    const seam = cardVisual(P({ fadeFalloff: 0, curve: 1, risePerTurn: 400 }), 12, 12, 24, 1, 0, 12);
    expect(seam.opacity).toBeCloseTo(0, 6);
  });

  it("never lets a card reach the camera, however deep the slider goes", () => {
    // Past the eye a card's perspective scale flips sign and it renders as
    // garbage, so depth has to saturate rather than sail through.
    for (const depth of [1, 5, 20, 200]) {
      const v = cardVisual(P({ curve: 0.8, invert: true, depth, distance: 900 }), 4, 4, 12);
      expect(v.z, `depth ${depth}`).toBeLessThan(900);
      expect(Number.isFinite(v.z)).toBe(true);
    }
  });

  // "Produces no NaN for any preset at any offset" lives in presets.test.ts now
  // that the presets exist — it belongs next to the numbers it guards.
});
