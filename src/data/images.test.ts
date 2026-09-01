import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { IMAGES } from "./images";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");

describe("prepared images", () => {
  it("has all twenty-five, in filename order", () => {
    expect(IMAGES).toHaveLength(25);
    const numbers = IMAGES.map((image) => Number(image.slug.slice(0, 2)));
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("gives every one a unique, url-safe slug", () => {
    for (const image of IMAGES) expect(image.slug).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(IMAGES.map((i) => i.slug)).size).toBe(IMAGES.length);
  });

  it("points at files that are actually there", () => {
    for (const image of IMAGES) {
      expect(image.src, image.slug).toMatch(/^\/img\/[a-z0-9-]+\.webp$/);
      expect(image.srcSmall, image.slug).toMatch(/^\/img\/[a-z0-9-]+@0\.5x\.webp$/);
      expect(existsSync(path.join(PUBLIC_DIR, image.src)), image.src).toBe(true);
      expect(existsSync(path.join(PUBLIC_DIR, image.srcSmall)), image.srcSmall).toBe(true);
    }
  });

  it("prepares everything square, so cardAspect can crop from the centre", () => {
    for (const image of IMAGES) {
      expect(image.width, image.slug).toBe(1200);
      expect(image.height, image.slug).toBe(1200);
    }
  });

  it("carries a placeholder small enough to inline", () => {
    for (const image of IMAGES) {
      expect(image.blurData, image.slug).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
      expect(image.blurData.length, image.slug).toBeLessThan(900);
    }
  });

  it("keeps no source PNG anywhere in the deploy", () => {
    // 92MB of prototype stills have no business in public/ — only the webp ships.
    expect(existsSync(path.join(PUBLIC_DIR, "images"))).toBe(false);
    for (const image of IMAGES) expect(image.src).not.toMatch(/\.png$/i);
  });

  it("gives every image alt text, written from the picture", () => {
    // Written by looking at each one, never inferred from a filename — the
    // filenames here are Midjourney prompts, which describe what was asked for
    // rather than what came out. Edit src/data/image-alt.json and re-run
    // `pnpm prep:images`.
    for (const image of IMAGES) {
      const words = image.alt.trim().split(/\s+/);
      expect(words.length, `${image.slug}: "${image.alt}"`).toBeGreaterThanOrEqual(8);
      expect(words.length, `${image.slug}: "${image.alt}"`).toBeLessThanOrEqual(22);
      expect(image.alt, image.slug).not.toMatch(/^(image|picture|photo) of/i);
      expect(image.alt, `${image.slug} ends without a full stop`).toMatch(/\.$/);
      // A line that is just the filename back again is the failure this rule
      // exists to prevent, and it is invisible unless something checks.
      const fromSlug = image.slug.replace(/^\d+-/, "").replace(/-/g, " ");
      expect(image.alt.toLowerCase(), `${image.slug} reads like its filename`).not.toBe(fromSlug);
    }
  });
});
