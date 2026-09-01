import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PARAM_META } from "./defaults";
import { cardVisual } from "./geometry";
import { cautionReason, inertReason } from "./inert";
import { PRESETS, presetParams } from "./presets";
import type { CarouselParams } from "./types";

const P = (over: Partial<CarouselParams> = {}): CarouselParams => ({ ...DEFAULT_PARAMS, ...over });

/**
 * A slider that moves while the picture does not reads as a broken tool. Rather
 * than give those parameters a second job, the editor greys them out and says
 * why — so this has to know which ones, and be right about it.
 */
describe("inertReason", () => {
  it("says nothing about a parameter that is doing its job", () => {
    expect(inertReason("depth", P({ curve: 0.4 }))).toBeNull();
    expect(inertReason("spacing", P())).toBeNull();
    expect(inertReason("sizeFalloff", P())).toBeNull();
  });

  it("catches the flagged case: depth needs a curve to deepen", () => {
    expect(inertReason("depth", P({ curve: 0 }))).toMatch(/curve/i);
  });

  it("catches everything else the curve switches off", () => {
    const flat = P({ curve: 0 });
    for (const key of ["arcRotation", "cardFacing", "risePerTurn", "invert"] as const) {
      expect(inertReason(key, flat), key).toMatch(/curve/i);
    }
  });

  it("knows the camera has nothing to project when the arrangement is flat", () => {
    expect(inertReason("distance", P({ curve: 0 }))).not.toBeNull();
    expect(inertReason("distance", P({ curve: 0.5, depth: 0 }))).not.toBeNull();
    // A ring lying in the screen plane is flat too, however hard it curves.
    expect(inertReason("distance", P({ curve: 1, arcRotation: 90 }))).not.toBeNull();
    expect(inertReason("distance", P({ curve: 1, arcRotation: 0 }))).toBeNull();
  });

  it("greys out what a switched-off toggle controls", () => {
    expect(inertReason("autoplayInterval", P({ autoplay: false }))).toMatch(/autoplay/i);
    expect(inertReason("pauseOnHover", P({ autoplay: false }))).toMatch(/autoplay/i);
    expect(inertReason("autoplayInterval", P({ autoplay: true }))).toBeNull();
    expect(inertReason("dragWeight", P({ drag: false }))).toMatch(/drag/i);
    expect(inertReason("cardUpright", P({ tilt: 0 }))).toMatch(/tilt/i);
    expect(inertReason("cardUpright", P({ tilt: -20 }))).toBeNull();
  });

  it("greys out the reveal's companions while card content never shows", () => {
    // The default is cardReveal "never" — all of these do nothing there.
    expect(inertReason("revealZoom", P())).toMatch(/never/i);
    expect(inertReason("contentLayout", P())).toMatch(/never/i);
    expect(inertReason("buttonScale", P())).toMatch(/never/i);
    expect(inertReason("textScale", P())).toMatch(/never/i);
    expect(inertReason("revealZoom", P({ cardReveal: "hover" }))).toBeNull();
    expect(inertReason("contentLayout", P({ cardReveal: "focus" }))).toBeNull();
    expect(inertReason("buttonScale", P({ cardReveal: "both" }))).toBeNull();
  });

  it("greys out the text dial where the layout has taken the words away", () => {
    // Button-only moves the title and caption off screen — they stay in the
    // markup for a screen reader, but there is nothing left on screen to size.
    const shown = { cardReveal: "focus" } as const;
    expect(inertReason("textScale", P({ ...shown, contentLayout: "button" }))).toMatch(/button/i);
    expect(inertReason("textScale", P({ ...shown, contentLayout: "panel" }))).toBeNull();
    // The button keeps working there, so its own dial stays live.
    expect(inertReason("buttonScale", P({ ...shown, contentLayout: "button" }))).toBeNull();
  });

  it("names a real parameter in every explanation, so the note can be trusted", () => {
    const flat = P({ curve: 0, depth: 0, autoplay: false, drag: false, tilt: 0 });
    for (const key of Object.keys(PARAM_META) as (keyof CarouselParams)[]) {
      const reason = inertReason(key, flat);
      if (reason === null) continue;
      expect(reason.length, key).toBeGreaterThan(8);
      expect(reason.endsWith("."), key).toBe(true);
    }
  });

  /**
   * The claim has to be true, not merely plausible: move a parameter the whole
   * width of its range and if the engine's output changes anywhere, it was not
   * inert and the editor would be lying to the visitor.
   */
  it("only ever calls a parameter inert when moving it really changes nothing", () => {
    const cases: CarouselParams[] = [
      P({ curve: 0 }),
      P({ curve: 0.5, depth: 0 }),
      P({ curve: 1, arcRotation: 90 }),
      P({ autoplay: false, drag: false, tilt: 0 }),
      ...PRESETS.map((preset) => presetParams(preset.slug)),
    ];

    for (const params of cases) {
      for (const [key, meta] of Object.entries(PARAM_META)) {
        if (meta.kind !== "number") continue;
        const name = key as keyof CarouselParams;
        if (inertReason(name, params) === null) continue;

        for (const value of [meta.min, meta.max]) {
          const moved = { ...params, [name]: value };
          for (let offset = -6; offset <= 6; offset += 0.5) {
            const before = cardVisual(params, offset, Math.round(offset), 12);
            const after = cardVisual(moved, offset, Math.round(offset), 12);
            for (const field of Object.keys(before) as (keyof typeof before)[]) {
              expect(after[field], `${name}=${value} moved ${field} at ${offset}`).toBeCloseTo(
                before[field],
                6,
              );
            }
          }
        }
      }
    }
  });
});

/**
 * Card angle is the one control that keeps working while it stops being able to
 * finish: it turns the cards whatever else is set, but without depth it cannot
 * stack them, so they pass through each other. It stays live and says so.
 */
describe("cautionReason", () => {
  it("says nothing about a control that is doing its whole job", () => {
    // Coverflow's own settings — a curve to stack against, so it works.
    expect(cautionReason("cardAngle", presetParams("coverflow"))).toBeNull();
    expect(cautionReason("cardAngle", P({ curve: 0.16, cardAngle: 90 }))).toBeNull();
  });

  it("says nothing about any other control, ever", () => {
    const worst = P({ curve: 0, depth: 0, cardAngle: 90, spacing: 40 });
    for (const key of Object.keys(PARAM_META) as (keyof CarouselParams)[]) {
      if (key === "cardAngle") continue;
      expect(cautionReason(key, worst), key).toBeNull();
    }
  });

  it("speaks up on a flat arrangement whose turned cards meet", () => {
    // The reported case: Flat fan with the angle pushed up and the cards close.
    const reported = { ...presetParams("flat-fan"), cardAngle: 53, spacing: 100 };
    expect(cautionReason("cardAngle", reported)).toMatch(/depth/i);

    // And each of the three ways an arrangement ends up with no depth at all.
    for (const flat of [{ curve: 0 }, { curve: 0.5, depth: 0 }, { curve: 1, arcRotation: 90 }]) {
      const params = P({ ...flat, cardAngle: 70, cardWidth: 320, spacing: 120 });
      expect(cautionReason("cardAngle", params), JSON.stringify(flat)).not.toBeNull();
    }
  });

  it("stays quiet where the turn cannot reach a neighbour", () => {
    // Straight on, so nothing swings out of the plane.
    expect(cautionReason("cardAngle", P({ curve: 0, cardAngle: 0 }))).toBeNull();
    // Turned hard, but the cards are too far apart to ever meet.
    expect(cautionReason("cardAngle", P({ curve: 0, cardAngle: 80, cardWidth: 200, spacing: 400 }))).toBeNull();
  });

  it("leaves all twelve styles alone, because none of them asks for this", () => {
    for (const preset of PRESETS) {
      expect(cautionReason("cardAngle", presetParams(preset.slug)), preset.slug).toBeNull();
    }
  });
});
