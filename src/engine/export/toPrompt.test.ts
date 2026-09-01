import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PARAM_META } from "../defaults";
import { PRESETS, presetBySlug, presetParams } from "../presets";
import type { CarouselParams } from "../types";
import { toPrompt } from "./toPrompt";

const forPreset = (slug: string) => {
  const preset = presetBySlug(slug)!;
  return toPrompt({ params: presetParams(slug), cards: preset.cards, styleName: preset.name });
};

/**
 * The other thing you leave with: a description precise enough that Claude,
 * Cursor or ChatGPT can rebuild the effect in React, Vue or Webflow. It covers
 * every framework without us maintaining a single one of them, and it is the
 * cheapest feature in the spec — so it has to be *right*, not merely fluent.
 */
describe("toPrompt", () => {
  it("opens by naming what to build", () => {
    expect(forPreset("coverflow")).toMatch(/^Build a 3D coverflow carousel\./);
    expect(toPrompt({ params: presetParams("helix"), cards: 24 })).toMatch(/^Build a 3D carousel\./);
  });

  it("says every number it uses, and says them the way the parameters are set", () => {
    const params = presetParams("coverflow");
    const prompt = forPreset("coverflow");
    const number = (pattern: RegExp) => {
      const found = pattern.exec(prompt);
      expect(found, `${pattern} is not in the prompt`).not.toBeNull();
      return Number(found![1]);
    };

    expect(number(/(\d+)\s*cards/)).toBe(14);
    expect(number(/(\d+)×\d+px cards/)).toBe(params.cardWidth);
    expect(number(/×(\d+)px cards/)).toBe(Math.round(params.cardWidth * params.cardAspect));
    expect(number(/(\d+)px corners/)).toBe(params.cardRadius);
    expect(number(/(\d+)px apart/)).toBe(params.spacing);
    expect(number(/up to (\d+)°/)).toBe(params.cardAngle);
    expect(number(/perspective (\d+)px/)).toBe(params.distance);
    expect(number(/takes (\d+)ms/)).toBe(params.speed);
    expect(number(/1\/\(1\+([\d.]+)/)).toBe(params.sizeFalloff);
    expect(number(/opacity falls ([\d.]+)/)).toBe(params.fadeFalloff);
  });

  /**
   * What the prose calls a parameter, where that is not what the panel calls it.
   *
   * The two vocabularies were split on 11 Aug 2026: the panel's labels are for
   * somebody deciding what to drag, and the prompt's words are for a model
   * rebuilding the thing from scratch. Mostly they still overlap enough for the
   * label to stand in below. Where they do not, the proof that a parameter
   * reached the prose is written out here — and it lives in the test rather
   * than in PARAM_META, because it is this test's business and nothing else's.
   */
  const PROSE: Partial<Record<keyof CarouselParams, (p: CarouselParams) => string>> = {
    // Aspect is never stated as a ratio. It is stated as the height it
    // produces, which is the number somebody rebuilding this actually needs.
    cardAspect: (p) => `×${Math.round(p.cardWidth * p.cardAspect)}px`,
  };

  it("mentions every parameter a style actually changes", () => {
    for (const preset of PRESETS) {
      const prompt = forPreset(preset.slug);
      const params = presetParams(preset.slug);
      for (const key of Object.keys(preset.params) as (keyof CarouselParams)[]) {
        const meta = PARAM_META[key];
        const value = preset.params[key];
        // Named by its own words, or by its value — "52°" is as good as "yaw".
        // Singular counts: the prose says "arrow buttons", not "arrows".
        const label = (PROSE[key]?.(params) ?? meta.label.split(" ")[0]).toLowerCase();
        const stem = label.endsWith("s") ? label.slice(0, -1) : label;
        const mentioned =
          prompt.toLowerCase().includes(stem) ||
          // Not \b at the end — the numbers are written with their units
          // attached, and "216px" has no word boundary after the 6.
          (typeof value === "number" &&
            new RegExp(`\\b${String(Math.round(value * 100) / 100)}(?!\\d)`).test(prompt));
        expect(mentioned, `${preset.slug} never mentions ${key} (${String(value)})`).toBe(true);
      }
    }
  });

  it("stays quiet about the things a style leaves alone", () => {
    // A description that lists every dial at its default is a dump, not a
    // description — and an AI reading it cannot tell what matters.
    const plain = toPrompt({ params: { ...DEFAULT_PARAMS }, cards: 10 });
    expect(plain).not.toMatch(/autoplay every/i);
    expect(plain).not.toMatch(/jitter/i);
    expect(plain).not.toMatch(/concentric ring/i);
    expect(plain).not.toMatch(/second row/i);
    expect(plain).not.toMatch(/helix|climbs/i);
    expect(plain).not.toMatch(/card content|hover/i);
  });

  it("describes the centred-button layout when that is what was chosen", () => {
    const params = { ...DEFAULT_PARAMS, cardReveal: "hover", contentLayout: "button" } as CarouselParams;
    const prompt = toPrompt({ params, cards: 8 });
    expect(prompt).toMatch(/only the button, centred/i);
    expect(prompt).toMatch(/visually hidden/i);
    // And the panel layout keeps its existing description, with no mention of it.
    const panel = toPrompt({ params: { ...params, contentLayout: "panel" } as CarouselParams, cards: 8 });
    expect(panel).not.toMatch(/only the button/i);
  });

  it("says the button's size only when it has been changed", () => {
    const base = { ...DEFAULT_PARAMS, cardReveal: "hover" } as CarouselParams;
    const grown = toPrompt({ params: { ...base, buttonScale: 1.5 } as CarouselParams, cards: 8 });
    expect(grown).toMatch(/button at 1\.5× its usual size/i);
    expect(toPrompt({ params: base, cards: 8 })).not.toMatch(/usual size/i);
  });

  it("describes a flat track as flat, rather than as an arc of infinite radius", () => {
    const flat = forPreset("flat-fan");
    expect(flat).toMatch(/straight track/i);
    expect(flat).not.toMatch(/radius/i);
    expect(forPreset("coverflow")).toMatch(/radius \d+px/);
  });

  it("always ends with what to do about reduced motion", () => {
    for (const preset of PRESETS) {
      expect(forPreset(preset.slug), preset.slug).toMatch(
        /prefers-reduced-motion[\s\S]*crossfade[\s\S]*$/,
      );
    }
  });

  it("is one readable brief, not a list of settings", () => {
    for (const preset of PRESETS) {
      const prompt = forPreset(preset.slug);
      expect(prompt, preset.slug).not.toContain("undefined");
      expect(prompt, preset.slug).not.toContain("NaN");
      expect(prompt, preset.slug).not.toContain("  ");
      expect(prompt.length, preset.slug).toBeGreaterThan(400);
      expect(prompt.length, preset.slug).toBeLessThan(2200);
    }
  });

  it("says the same thing every time it is asked", () => {
    expect(forPreset("vortex")).toBe(forPreset("vortex"));
  });

  it("matches its snapshot for every style", () => {
    const all = PRESETS.map((preset) => `## ${preset.name}\n${forPreset(preset.slug)}`).join("\n\n");
    expect(all).toMatchSnapshot();
  });
});
