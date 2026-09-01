import { afterEach, describe, expect, it, vi } from "vitest";
import { createCarousel } from "../controller";
import type { CarouselItem } from "../controller";
import { PRESETS, presetParams } from "../presets";
import { toHtml } from "./toHtml";

const items = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `card ${i}` }));

/** Every card's transform, opacity and blur, in the order they were built. */
function readCards(root: Element): string[] {
  return [...root.querySelectorAll(".cg-item")].map((item) => {
    const card = item.querySelector(".cg-card") as HTMLElement;
    return [
      (item as HTMLElement).style.transform,
      (item as HTMLElement).style.width,
      (item as HTMLElement).style.height,
      card?.style.opacity ?? "",
      card?.style.filter ?? "",
      card?.style.borderRadius ?? "",
    ].join(" | ");
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  document.getElementById("cg-styles")?.remove();
});

/**
 * The test the whole architecture exists for.
 *
 * The preview and the copied snippet are meant to be *the same code* — one
 * vanilla core, mounted by React in one place and inlined into a script tag in
 * the other. The alternative, a React implementation plus an exporter that emits
 * something equivalent, is two implementations of the same maths that drift
 * within a week, and every drift ships as a bug in somebody else's website.
 *
 * So: mount the controller directly, then run the exported block, and compare
 * every card the two produce. If anyone ever reintroduces a second
 * implementation, this is what fails.
 */
describe("the preview and the copied code", () => {
  it("produce identical cards, for every one of the twelve", () => {
    for (const preset of PRESETS) {
      const params = presetParams(preset.slug);
      const cards = items(preset.cards);

      const live = document.createElement("div");
      document.body.appendChild(live);
      const instance = createCarousel(live, { items: cards, params });
      const fromPreview = readCards(live);

      const exported = document.createElement("div");
      exported.innerHTML = toHtml({ params, items: cards, id: `parity-${preset.slug}` });
      document.body.appendChild(exported);
      for (const script of exported.querySelectorAll("script")) {
        (0, eval)(script.textContent!);
      }
      const fromSnippet = readCards(exported);

      expect(fromSnippet.length, `${preset.slug}: card count`).toBe(fromPreview.length);
      expect(fromSnippet.length, `${preset.slug}: nothing rendered`).toBeGreaterThan(0);
      expect(fromSnippet, `${preset.slug} drifted from its own preview`).toEqual(fromPreview);

      instance.destroy();
      live.remove();
      exported.remove();
    }
  });

  it("agree after the same move, not just at rest", () => {
    // Resting parity is the easy half — two carousels that have both done
    // nothing agree trivially. The animator, the wrapping and the rounding all
    // have to land in the same place after a step, which needs the clock to
    // actually run: without advancing it, both sit at zero and this proves
    // nothing. The assertion at the end that they *moved* is what keeps it
    // honest.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const params = presetParams("concave-arc");
    const cards = items(7);

    const live = document.createElement("div");
    document.body.appendChild(live);
    const instance = createCarousel(live, { items: cards, params });
    const atRest = readCards(live);

    const exported = document.createElement("div");
    exported.innerHTML = toHtml({ params, items: cards, id: "parity-moved" });
    document.body.appendChild(exported);
    for (const script of exported.querySelectorAll("script")) {
      (0, eval)(script.textContent!);
    }
    expect(
      (globalThis as unknown as { Carousel3D?: unknown }).Carousel3D,
      "the exported bundle did not define its global",
    ).toBeTruthy();

    // Drive both three cards along. The snippet does not hand its instance back,
    // so it gets driven the way a visitor would — with the keyboard.
    const root = exported.querySelector(".cg-root")!;
    for (let i = 0; i < 3; i++) {
      instance.next();
      root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      vi.advanceTimersByTime(900);
    }
    vi.advanceTimersByTime(900);

    const moved = readCards(live);
    expect(moved, "nothing moved, so this test proved nothing").not.toEqual(atRest);
    expect(instance.index()).toBe(3);
    expect(readCards(exported)).toEqual(moved);

    instance.destroy();
    vi.useRealTimers();
  });
});
