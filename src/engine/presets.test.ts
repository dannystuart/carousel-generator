import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PARAM_META } from "./defaults";
import { cardVisual } from "./geometry";
import { visibleRange } from "./layout";
import { PRESETS, presetBySlug, presetParams } from "./presets";
import type { CarouselParams } from "./types";

/**
 * Guard rails for the twelve. Nothing here judges whether a style *looks* right
 * — that is done by eye against the reference images, and the numbers that come
 * out of it are locked in presets.ts. What these do is make sure a later change
 * to the geometry cannot quietly poison one of them.
 */
describe("PRESETS", () => {
  it("there are exactly twelve", () => {
    expect(PRESETS).toHaveLength(12);
  });

  it("every slug is unique and url-safe", () => {
    const slugs = PRESETS.map((preset) => preset.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every preset carries the copy and the card count a style page needs", () => {
    for (const preset of PRESETS) {
      expect(preset.name.length, preset.slug).toBeGreaterThan(2);
      expect(preset.oneLiner.length, preset.slug).toBeGreaterThan(20);
      expect(preset.reference.length, preset.slug).toBeGreaterThan(2);
      expect(preset.cards, preset.slug).toBeGreaterThanOrEqual(5);
      expect(preset.cards, preset.slug).toBeLessThanOrEqual(25);
    }
  });

  it("every preset validates against the parameter ranges", () => {
    for (const preset of PRESETS) {
      for (const [key, value] of Object.entries(preset.params)) {
        const meta = PARAM_META[key as keyof CarouselParams];
        expect(meta, `${preset.slug}: unknown parameter ${key}`).toBeDefined();
        if (meta.kind === "number") {
          expect(value, `${preset.slug}.${key}`).toBeGreaterThanOrEqual(meta.min);
          expect(value, `${preset.slug}.${key}`).toBeLessThanOrEqual(meta.max);
        }
        if (meta.kind === "enum") {
          expect(meta.options, `${preset.slug}.${key}`).toContain(value);
        }
      }
    }
  });

  it("every preset produces finite values at every offset", () => {
    for (const preset of PRESETS) {
      const params = presetParams(preset.slug);
      for (const ring of params.rings) {
        for (let offset = -30; offset <= 30; offset += 0.25) {
          const visual = cardVisual(params, offset, Math.round(offset), preset.cards, ring.scale);
          for (const [key, value] of Object.entries(visual)) {
            expect(Number.isFinite(value), `${preset.slug} ${key} at ${offset}`).toBe(true);
          }
          expect(visual.scale, preset.slug).toBeGreaterThan(0);
          expect(visual.opacity, preset.slug).toBeGreaterThanOrEqual(0);
          expect(visual.opacity, preset.slug).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("keeps every card in front of the camera, so none of them turn inside out", () => {
    // A card that crosses the eye gets a negative perspective divisor and paints
    // as garbage. Depth saturates to stop it, but a preset should not be leaning
    // on that clamp — if one is up against it, the numbers are wrong. Only
    // offsets a card can actually reach count: on a looping set nothing ever
    // gets further than half a ring away.
    for (const preset of PRESETS) {
      const params = presetParams(preset.slug);
      const reach = Math.min(
        visibleRange(params, preset.cards),
        params.loop ? preset.cards / 2 : preset.cards - 1,
      );
      for (const ring of params.rings) {
        for (let offset = -reach; offset <= reach; offset += 0.5) {
          const { z } = cardVisual(params, offset, Math.round(offset), preset.cards, ring.scale);
          expect(z, `${preset.slug} at ${offset}`).toBeLessThan(params.distance * 0.8);
        }
      }
    }
  });

  it("leaves parameters it does not care about at the default", () => {
    // The Code output only prints what differs from the default, so a preset
    // that restates a default makes the copied snippet noisier for no reason.
    for (const preset of PRESETS) {
      for (const [key, value] of Object.entries(preset.params)) {
        const fallback = DEFAULT_PARAMS[key as keyof CarouselParams];
        expect(JSON.stringify(value), `${preset.slug}.${key} restates the default`).not.toBe(
          JSON.stringify(fallback),
        );
      }
    }
  });

  it("looks a preset up by slug and fills the rest in from the defaults", () => {
    const coverflow = presetBySlug("coverflow");
    expect(coverflow?.name).toBe("Coverflow");
    expect(presetBySlug("no-such-style")).toBeUndefined();

    const params = presetParams("coverflow");
    expect(params.easing).toBe(DEFAULT_PARAMS.easing);
    expect(params.curve).toBe(coverflow?.params.curve);
  });
});
