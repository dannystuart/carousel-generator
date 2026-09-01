import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCarousel } from "./controller";
import type { CarouselItem } from "./controller";
import { CAROUSEL_CSS } from "./styles";
import type { CarouselParams } from "./types";

const items = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `card ${i}` }));

let root: HTMLDivElement;

/** A matchMedia that answers the reduced-motion query, and can change its mind. */
function stubReducedMotion(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_type: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
    addListener: (fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
    removeListener: (fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
    dispatchEvent: () => true,
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    change(now: boolean) {
      query.matches = now;
      listeners.forEach((fn) => fn({ matches: now } as MediaQueryListEvent));
    },
  };
}

const transforms = () =>
  [...root.querySelectorAll<HTMLElement>(".cg-item")].map((el) => el.style.transform);

beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});

afterEach(() => {
  root.remove();
  document.getElementById("cg-styles")?.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("reduced motion", () => {
  it("arrives in one tick instead of sweeping", () => {
    stubReducedMotion(true);
    const carousel = createCarousel(root, { items: items(12), params: { speed: 620 } });
    carousel.goTo(5);
    expect(carousel.position()).toBe(5);
    expect(carousel.index()).toBe(5);
    carousel.destroy();
  });

  it("never starts autoplay", () => {
    stubReducedMotion(true);
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const carousel = createCarousel(root, {
      items: items(8),
      params: { autoplay: true, autoplayInterval: 300 },
    });
    vi.advanceTimersByTime(5000);
    expect(carousel.index()).toBe(0);
    carousel.destroy();
  });

  it("freezes drift too — nothing moves on its own", () => {
    stubReducedMotion(true);
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const carousel = createCarousel(root, {
      items: items(8),
      params: { rings: [{ scale: 1, drift: 1 }] },
    });
    const before = transforms();
    vi.advanceTimersByTime(3000);
    expect(transforms()).toEqual(before);
    carousel.destroy();
  });

  it("leaves the arrangement exactly as designed", () => {
    // The spec is explicit: ring, angles, depth and pitch are untouched. Only
    // the way you get from one card to the next changes.
    const shape: Partial<CarouselParams> = {
      curve: 0.8,
      cardAngle: 40,
      depth: 1.4,
      pitch: 35,
      tilt: -12,
      arcRotation: 25,
      invert: true,
      sizeFalloff: 0.3,
      blurFalloff: 3,
    };

    stubReducedMotion(false);
    const normal = createCarousel(root, { items: items(10), params: shape });
    const asDesigned = transforms();
    normal.destroy();

    stubReducedMotion(true);
    const reduced = createCarousel(root, { items: items(10), params: shape });
    expect(transforms()).toEqual(asDesigned);
    reduced.destroy();
  });

  it("crossfades on opacity alone, never on transform", () => {
    stubReducedMotion(true);
    const carousel = createCarousel(root, { items: items(6) });
    expect(root.classList.contains("cg-root--reduced")).toBe(true);

    const rule = CAROUSEL_CSS.slice(CAROUSEL_CSS.indexOf(".cg-root--reduced"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toMatch(/transition:\s*opacity 180ms/);
    expect(body).not.toMatch(/transform/);
    carousel.destroy();
  });

  // An instant jump gives the browser's own 3D sort nothing to re-evaluate, so
  // this path was the first to need the order written out. It is written on
  // every path now — see the paint-order test in controller.test.ts — and this
  // checks the one that cannot do without it has not lost it.
  it("still gives every card an order to be drawn in", () => {
    stubReducedMotion(true);
    const carousel = createCarousel(root, { items: items(8), params: { curve: 0.6 } });
    for (const item of root.querySelectorAll<HTMLElement>(".cg-item")) {
      expect(item.style.zIndex).not.toBe("");
    }
    carousel.destroy();
  });

  it("follows the setting being changed while the page is open", () => {
    const media = stubReducedMotion(false);
    const carousel = createCarousel(root, { items: items(10), params: { speed: 620 } });
    expect(root.classList.contains("cg-root--reduced")).toBe(false);

    media.change(true);
    expect(root.classList.contains("cg-root--reduced")).toBe(true);
    carousel.goTo(3);
    expect(carousel.position()).toBe(3);

    media.change(false);
    expect(root.classList.contains("cg-root--reduced")).toBe(false);
    carousel.goTo(6);
    expect(carousel.position()).not.toBe(6); // back to sweeping
    carousel.destroy();
  });

  it("takes the class with it on destroy", () => {
    stubReducedMotion(true);
    const carousel = createCarousel(root, { items: items(6) });
    carousel.destroy();
    expect(root.className).toBe("");
  });

  it("copes with a browser that has no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const carousel = createCarousel(root, { items: items(6) });
    expect(root.classList.contains("cg-root--reduced")).toBe(false);
    expect(() => carousel.next()).not.toThrow();
    carousel.destroy();
  });
});
