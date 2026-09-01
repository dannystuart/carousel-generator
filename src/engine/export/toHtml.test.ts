import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../defaults";
import { PRESETS, presetParams } from "../presets";
import { ENGINE_HASH, ENGINE_SOURCE } from "../dist/engineSource";
import { SETTINGS_MARKER, toHtml } from "./toHtml";
import type { CarouselItem } from "../controller";

const pictures = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `picture ${i}` }));

const rich = (n: number): CarouselItem[] =>
  pictures(n).map((item, i) => ({ ...item, href: `/work/${i}`, title: `Card ${i}`, cta: "View" }));

describe("toHtml", () => {
  it("matches the golden coverflow block", () => {
    // A whole snippet, committed, so a change to any of the pieces that make it
    // shows up as a diff a person reads rather than as a test that quietly still
    // passes. Deliberate change: UPDATE_GOLDEN=1 pnpm test, then read the diff.
    //
    // The engine itself stands in as its hash. Eighteen kilobytes of minified
    // JavaScript on one line churns the whole file every time a variable gets
    // renamed, which buries the parts a person is supposed to review — and the
    // bundle's own test already pins it to its sources.
    const file = path.join(__dirname, "__golden__", "coverflow.html");
    const html = toHtml({ params: presetParams("coverflow"), items: pictures(14) }).replace(
      ENGINE_SOURCE,
      `/* the engine, ${ENGINE_HASH} — see src/engine/dist/engineSource.ts */`,
    );
    if (process.env.UPDATE_GOLDEN) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, html);
    }
    expect(html, "the emitted block has changed — read the diff, then UPDATE_GOLDEN=1").toBe(
      readFileSync(file, "utf8"),
    );
  });

  // The engine minifies to eighteen kilobytes containing the name of every
  // parameter there is, so asking whether the whole block "contains pitch:"
  // answers a question about the engine rather than about the snippet.
  const settingsOf = (html: string) => {
    const at = html.indexOf(SETTINGS_MARKER);
    expect(at, "the settings marker went missing").toBeGreaterThan(-1);
    return html.slice(at);
  };

  it("never points at our own images", () => {
    const html = toHtml({ params: presetParams("coverflow"), items: pictures(6) });
    // Hotlinking our bandwidth into somebody else's site, and breaking their
    // page the day we move a file. Relative placeholders, always.
    const settings = settingsOf(html);
    expect(settings).not.toContain("/img/");
    expect(settings).not.toMatch(/https?:\/\//);
    expect(settings).toContain("./images/1.jpg");
    expect(settings).toMatch(/swap these for your own/i);
    // The header comment does carry the tool's address, which is the point of
    // it — and it is pinned whole, character for character. This is the one line
    // that leaves here and lands on somebody else's page, where a wrong path is
    // a 404 we cannot reach in to fix. A substring match on "carousel-generator"
    // would have sat there passing while the address in front of it rotted.
    expect(html.split("\n")[0]).toBe(
      "<!-- 3D carousel · built with https://vanta.supply/tools/web-carousel-generator -->",
    );
  });

  it("writes only what differs from the defaults", () => {
    const settings = settingsOf(toHtml({ params: presetParams("coverflow"), items: pictures(6) }));
    expect(settings).toContain("curve: 0.16");
    // Coverflow leaves these alone, so naming them would be noise in the
    // snippet and a lie about what the style is made of.
    expect(settings).not.toContain("pitch:");
    expect(settings).not.toContain("autoplayInterval:");
    expect(settings).not.toContain("easing:");
  });

  it("carries the card's own fields only when a card uses them", () => {
    const plainBlock = settingsOf(toHtml({ params: presetParams("coverflow"), items: pictures(4) }));
    expect(plainBlock).not.toContain("href:");
    expect(plainBlock).not.toContain("cta:");

    const richBlock = settingsOf(toHtml({ params: presetParams("coverflow"), items: rich(4) }));
    expect(richBlock).toContain('href: "/work/0"');
    expect(richBlock).toContain('title: "Card 0"');
    expect(richBlock).toContain('cta: "View"');
    expect(richBlock).toMatch(/web address/i);
    // Nothing about new tabs unless a card actually opens one.
    expect(richBlock).not.toContain("newTab:");
  });

  it("carries the new-tab flag, and says what it does", () => {
    const block = settingsOf(
      toHtml({
        params: presetParams("coverflow"),
        items: rich(3).map((item, i) => ({ ...item, newTab: i === 0 })),
      }),
    );
    expect(block).toContain("newTab: true");
    expect(block).toContain("newTab: false");
    expect(block).toMatch(/new tab/i);
  });

  /**
   * The demo cards point at example.com so the button is a button rather than a
   * picture of one. That placeholder rides out in the copied block, so the block
   * has to say so — emitting it silently is how somebody ships a carousel of
   * links to nowhere.
   */
  it("names the placeholder address rather than letting it slip out quietly", () => {
    const block = settingsOf(
      toHtml({
        params: presetParams("coverflow"),
        items: pictures(3).map((item) => ({ ...item, href: "https://example.com" })),
      }),
    );
    expect(block).toMatch(/placeholder/i);
    expect(block).toContain("example.com");

    // A real address gets no such warning.
    const real = settingsOf(
      toHtml({
        params: presetParams("coverflow"),
        items: pictures(3).map((item, i) => ({ ...item, href: `/work/${i}` })),
      }),
    );
    expect(real).not.toMatch(/placeholder/i);
  });

  it("has no undefined and no NaN for any of the twelve", () => {
    for (const preset of PRESETS) {
      const settings = settingsOf(
        toHtml({ params: presetParams(preset.slug), items: pictures(preset.cards) }),
      );
      expect(settings, preset.slug).not.toContain("undefined");
      expect(settings, preset.slug).not.toContain("NaN");
      expect(settings, preset.slug).not.toContain("[object Object]");
    }
  });

  it("runs, and builds the carousel it describes", () => {
    const html = toHtml({ params: presetParams("dual-orbit"), items: pictures(12) });
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);

    // jsdom parses <script> without running it, which is the point: this proves
    // the emitted script is the thing that builds the carousel, not the markup.
    const frame = host.querySelector("#carousel") as HTMLElement;
    expect(frame).not.toBeNull();
    expect(host.querySelector(".cg-root")).toBeNull();
    // The frame is what clips. Putting that on the carousel's own element
    // flattens preserve-3d and the arrangement collapses into a flat overlap.
    expect(frame.style.overflow).toBe("hidden");

    // The engine first, then the settings that start it — the two blocks a
    // browser would run in order.
    for (const script of host.querySelectorAll("script")) {
      expect(() => (0, eval)(script.textContent!)).not.toThrow();
    }
    const root = host.querySelector(".cg-root") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.parentElement).toBe(frame);
    expect(getComputedStyle(root).overflow).not.toBe("hidden");
    // Two rings of twelve.
    expect(root.querySelectorAll(".cg-item")).toHaveLength(24);

    host.remove();
    document.getElementById("cg-styles")?.remove();
  });

  it("ships the stylesheet the snippet actually needs, and no more", () => {
    const withArrows = toHtml({ params: presetParams("coverflow"), items: pictures(6) }).split("<script>")[0];
    expect(withArrows).toContain(".cg-arrow");
    expect(withArrows).not.toContain(".cg-dot");
    expect(withArrows).not.toContain(".cg-content");

    const withContent = toHtml({
      params: { ...DEFAULT_PARAMS, arrows: false, dots: true, cardReveal: "focus" },
      items: rich(6),
    }).split("<script>")[0];
    expect(withContent).not.toContain(".cg-arrow");
    expect(withContent).toContain(".cg-dot");
    expect(withContent).toContain(".cg-content");
  });
});
