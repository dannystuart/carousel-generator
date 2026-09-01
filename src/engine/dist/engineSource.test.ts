import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ENGINE_GLOBAL, ENGINE_HASH, ENGINE_INPUTS, ENGINE_SOURCE } from "./engineSource";

const ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * The committed bundle is what the app imports, so `pnpm build` needs no
 * pre-step — and this is the only thing standing between a stale bundle and
 * shipping somebody else broken code.
 */
describe("the embeddable engine", () => {
  it("still matches the sources it was built from", () => {
    const hash = createHash("sha256");
    for (const input of ENGINE_INPUTS) {
      hash.update(input);
      hash.update(readFileSync(path.join(ROOT, input)));
    }
    expect(
      `sha256:${hash.digest("hex")}`,
      "the engine has changed since the bundle was built — run `pnpm build:engine`",
    ).toBe(ENGINE_HASH);
  });

  it("is small enough to paste into somebody else's page", () => {
    // The plan guessed 12KB, before the engine grew rings, band rows, a
    // reduced-motion path, input that follows the track at any angle, and cards
    // that carry a link and their own content. It is 20.3KB minified and 8.0KB
    // over the wire — small for what it does, and the wire figure is the one
    // that costs a visitor anything.
    //
    // The one real saving has already been taken: the stylesheet is written to
    // be read, and the build strips its comments and indentation. Beyond that,
    // getting smaller would mean doing less. These bounds are a ratchet with the
    // measured numbers stated beside them, so drift shows up in the diff rather
    // than in a budget quietly raised again.
    //
    // Raised once, on 12 Aug 2026, from 20KB/8KB. Two things pushed it over:
    // cards that open in a new tab, and a content panel that sizes itself
    // against the card instead of cropping its own words on a small one. Worth
    // noting for whoever raises it next — the figures stated above had drifted
    // to 19.8KB and 7.9KB by then while still claiming 18.4 and 7.4, so the
    // ceiling had quietly been within 200 bytes for some time. The numbers here
    // are measured, not remembered.
    //
    // Raised again on 13 Aug 2026, from 21KB/8.5KB, by ~500 bytes: steering a
    // drifting ring. A tap aimed at the shared position alone and ignored how
    // far the ring's own turning had carried the cards, so it landed exactly
    // that many cards out and then turned on past. The fix is the inverse — aim
    // at where the ring will stand once it is still — plus winding the drift
    // down under anyone steering and back up afterwards, which is the part that
    // makes centring a card mean anything on a carousel that never stops. Not
    // compressible away: it is arithmetic and a clock, both load-bearing.
    const raw = Buffer.byteLength(ENGINE_SOURCE, "utf8");
    const compressed = gzipSync(ENGINE_SOURCE).length;
    expect(raw, `${(raw / 1024).toFixed(1)}KB minified, was 21.0`).toBeLessThan(21.5 * 1024);
    expect(compressed, `${(compressed / 1024).toFixed(1)}KB gzipped, was 8.3`).toBeLessThan(8.75 * 1024);
  });

  it("has no build step left in it", () => {
    expect(ENGINE_SOURCE).not.toContain("require(");
    expect(ENGINE_SOURCE).not.toContain("import(");
    expect(ENGINE_SOURCE).not.toMatch(/\bfrom\s*["']/);
    // Nothing from the app, and nothing from a package that would have to exist.
    expect(ENGINE_SOURCE).not.toContain("react");
  });

  it("defines its global and mounts a working carousel when evaluated", () => {
    // Indirect eval, so the bundle's top-level `var` lands on the window the way
    // a <script> tag would rather than inside a function scope.
    (0, eval)(ENGINE_SOURCE);

    const api = (globalThis as unknown as Record<string, unknown>)[ENGINE_GLOBAL] as {
      createCarousel: (root: HTMLElement, options: unknown) => { destroy(): void };
    };
    expect(typeof api?.createCarousel).toBe("function");

    const root = document.createElement("div");
    document.body.appendChild(root);
    const instance = api.createCarousel(root, {
      items: [
        { src: "a.webp", alt: "" },
        { src: "b.webp", alt: "" },
        { src: "c.webp", alt: "" },
      ],
      params: { curve: 0.4 },
    });

    expect(root.querySelectorAll(".cg-item").length).toBe(3);
    instance.destroy();
    expect(root.innerHTML).toBe("");
    root.remove();
  });
});
