import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCarousel } from "./controller";
import type { CarouselItem } from "./controller";
import { arcRadius } from "./geometry";
import { DEFAULT_PARAMS } from "./defaults";

const items = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `card ${i}` }));

let root: HTMLDivElement;

beforeEach(() => {
  root = document.createElement("div");
  root.style.width = "1200px";
  root.style.height = "600px";
  document.body.appendChild(root);
});

afterEach(() => {
  root.remove();
  document.getElementById("cg-styles")?.remove();
});

describe("createCarousel — mount", () => {
  it("builds root › stage › item › card › img", () => {
    const carousel = createCarousel(root, { items: items(6) });

    expect(root.classList.contains("cg-root")).toBe(true);
    const stages = root.querySelectorAll(".cg-stage");
    expect(stages).toHaveLength(1);

    const cards = root.querySelectorAll(".cg-item");
    expect(cards).toHaveLength(6);
    for (const item of cards) {
      expect(item.parentElement).toBe(stages[0]);
      const card = item.querySelector(".cg-card");
      expect(card).not.toBeNull();
      expect(card!.parentElement).toBe(item);
      expect(card!.querySelectorAll("img")).toHaveLength(1);
    }

    carousel.destroy();
  });

  it("takes src and alt from the items", () => {
    const carousel = createCarousel(root, { items: items(3) });
    const imgs = [...root.querySelectorAll<HTMLImageElement>(".cg-card img")];
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(["/img/0.webp", "/img/1.webp", "/img/2.webp"]);
    expect(imgs.map((i) => i.getAttribute("alt"))).toEqual(["card 0", "card 1", "card 2"]);
    carousel.destroy();
  });

  it("writes a transform on the very first paint, before any frame runs", () => {
    const carousel = createCarousel(root, { items: items(6) });
    const first = root.querySelector<HTMLElement>(".cg-item")!;
    expect(first.style.transform).toMatch(/translate3d\(/);
    // Nothing may sit at its untransformed position waiting for the script.
    for (const item of root.querySelectorAll<HTMLElement>(".cg-item")) {
      if (item.style.display === "none") continue;
      expect(item.style.transform).not.toBe("");
    }
    carousel.destroy();
  });

  it("injects its stylesheet once, however many carousels mount", () => {
    const second = document.createElement("div");
    document.body.appendChild(second);
    const a = createCarousel(root, { items: items(3) });
    const b = createCarousel(second, { items: items(3) });
    expect(document.querySelectorAll("#cg-styles")).toHaveLength(1);
    a.destroy();
    b.destroy();
    second.remove();
  });

  it("refuses to mount twice on the same element", () => {
    const carousel = createCarousel(root, { items: items(4) });
    expect(() => createCarousel(root, { items: items(4) })).toThrow(/already/i);
    carousel.destroy();
    // …and lets you mount again once it has been destroyed (React StrictMode).
    const again = createCarousel(root, { items: items(4) });
    expect(root.querySelectorAll(".cg-item")).toHaveLength(4);
    again.destroy();
  });

  it("survives an empty item list", () => {
    const carousel = createCarousel(root, { items: [] });
    expect(root.querySelectorAll(".cg-item")).toHaveLength(0);
    expect(() => carousel.next()).not.toThrow();
    carousel.destroy();
  });
});

describe("createCarousel — the four compositing rules", () => {
  it("puts filter on the card and never on the item", () => {
    const carousel = createCarousel(root, { items: items(8), params: { blurFalloff: 6 } });
    const items_ = [...root.querySelectorAll<HTMLElement>(".cg-item")];
    const blurred = items_.filter((i) => i.style.display !== "none");
    expect(blurred.length).toBeGreaterThan(1);
    for (const item of blurred) {
      expect(item.style.filter, "filter on .cg-item flattens the 3D context").toBe("");
    }
    const withBlur = [...root.querySelectorAll<HTMLElement>(".cg-card")].filter((c) =>
      c.style.filter.includes("blur"),
    );
    expect(withBlur.length).toBeGreaterThan(0);
    carousel.destroy();
  });

  it("leaves filter unset rather than blur(0px) when there is no blur", () => {
    // blur(0px) still promotes a layer and creates a containing block.
    const carousel = createCarousel(root, { items: items(6), params: { blurFalloff: 0 } });
    for (const card of root.querySelectorAll<HTMLElement>(".cg-card")) {
      expect(card.style.filter).toBe("");
    }
    carousel.destroy();
  });

  it("never puts a transition on the item's transform", () => {
    const carousel = createCarousel(root, { items: items(6) });
    for (const item of root.querySelectorAll<HTMLElement>(".cg-item")) {
      expect(item.style.transition).not.toMatch(/transform/);
    }
    const sheet = document.getElementById("cg-styles")!.textContent ?? "";
    const itemRule = sheet.slice(sheet.indexOf(".cg-item"), sheet.indexOf("}", sheet.indexOf(".cg-item")));
    expect(itemRule).not.toMatch(/transition/);
    carousel.destroy();
  });

  it("never clips the root or the stage, which would flatten preserve-3d", () => {
    const carousel = createCarousel(root, { items: items(6) });
    const stage = root.querySelector<HTMLElement>(".cg-stage")!;
    for (const el of [root, stage]) {
      const overflow = getComputedStyle(el).overflow;
      expect(overflow === "hidden" || overflow === "clip", `overflow: ${overflow}`).toBe(false);
    }
    carousel.destroy();
  });

  it("keeps the stage in a preserved 3D space", () => {
    const carousel = createCarousel(root, { items: items(6), params: { pitch: 40, tilt: -12 } });
    const stage = root.querySelector<HTMLElement>(".cg-stage")!;
    expect(stage.style.transformStyle).toBe("preserve-3d");
    expect(stage.style.transform).toContain("rotateX(40deg)");
    expect(stage.style.transform).toContain("rotateZ(-12deg)");
    expect(root.style.perspective).toBe("1400px");
    carousel.destroy();
  });
});

describe("createCarousel — setParams", () => {
  it("does not remount the DOM", () => {
    const carousel = createCarousel(root, { items: items(6) });
    const before = [...root.querySelectorAll(".cg-item")];
    const stage = root.querySelector(".cg-stage");

    carousel.setParams({ curve: 0.8, spacing: 400, cardAngle: 10 });

    expect(root.querySelector(".cg-stage")).toBe(stage);
    expect([...root.querySelectorAll(".cg-item")]).toEqual(before);
    carousel.destroy();
  });

  it("keeps its place when a slider moves", () => {
    const carousel = createCarousel(root, { items: items(12) });
    carousel.goTo(4);
    const index = carousel.index();
    carousel.setParams({ curve: 0.5 });
    expect(carousel.index()).toBe(index);
    carousel.destroy();
  });

  it("repaints with the new numbers straight away", () => {
    const carousel = createCarousel(root, { items: items(8), params: { curve: 0, spacing: 200 } });
    const second = root.querySelectorAll<HTMLElement>(".cg-item")[1];
    const before = second.style.transform;
    carousel.setParams({ spacing: 400 });
    expect(second.style.transform).not.toBe(before);
    carousel.destroy();
  });

  it("merges rather than replaces", () => {
    const carousel = createCarousel(root, { items: items(6), params: { curve: 0.5 } });
    carousel.setParams({ spacing: 300 });
    expect(carousel.params().curve).toBe(0.5);
    expect(carousel.params().spacing).toBe(300);
    carousel.destroy();
  });
});

describe("createCarousel — destroy", () => {
  it("leaves the root empty and unstyled", () => {
    const carousel = createCarousel(root, { items: items(6) });
    carousel.destroy();
    expect(root.innerHTML).toBe("");
    expect(root.classList.contains("cg-root")).toBe(false);
    expect(root.getAttribute("style") ?? "").not.toMatch(/perspective/);
  });

  it("removes every listener it added", () => {
    const targets = [root, window, document] as const;
    const added: string[] = [];
    const removed: string[] = [];
    const spies = targets.map((target, i) => [
      vi.spyOn(target, "addEventListener").mockImplementation((type: string) => {
        added.push(`${i}:${type}`);
      }),
      vi.spyOn(target, "removeEventListener").mockImplementation((type: string) => {
        removed.push(`${i}:${type}`);
      }),
    ]);

    const carousel = createCarousel(root, { items: items(6) });
    carousel.destroy();

    spies.flat().forEach((s) => s.mockRestore());
    // Every listener added is paired with a removal. That there ARE listeners
    // to remove is asserted in controller.interaction.test.ts, which is where
    // they get attached.
    expect([...added].sort()).toEqual([...removed].sort());
  });

  it("is idempotent, so StrictMode's double cleanup is harmless", () => {
    const carousel = createCarousel(root, { items: items(6) });
    carousel.destroy();
    expect(() => carousel.destroy()).not.toThrow();
    expect(() => carousel.next()).not.toThrow();
    expect(root.innerHTML).toBe("");
  });

  it("cancels its animation frame", () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const carousel = createCarousel(root, { items: items(6) });
    carousel.next();
    carousel.destroy();
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });
});

describe("createCarousel — moving", () => {
  it("steps forward, back and to a given card", () => {
    const carousel = createCarousel(root, { items: items(12), params: { speed: 0 } });
    expect(carousel.index()).toBe(0);
    carousel.next();
    expect(carousel.index()).toBe(1);
    carousel.next();
    expect(carousel.index()).toBe(2);
    carousel.prev();
    expect(carousel.index()).toBe(1);
    carousel.goTo(7);
    expect(carousel.index()).toBe(7);
    carousel.destroy();
  });

  it("wraps at the ends when looping, and stops when not", () => {
    const looping = createCarousel(root, { items: items(5), params: { speed: 0, loop: true } });
    looping.prev();
    expect(looping.index()).toBe(4);
    looping.destroy();

    const stopping = createCarousel(root, { items: items(5), params: { speed: 0, loop: false } });
    stopping.prev();
    expect(stopping.index()).toBe(0);
    stopping.goTo(99);
    expect(stopping.index()).toBe(4);
    stopping.destroy();
  });

  /**
   * The editor rebuilds the whole carousel whenever a style change alters the
   * card count. `startAt` is how the rebuild keeps the visitor's place — the
   * card they were on stays centred instead of snapping back to the first.
   */
  it("opens on the card asked for, from the very first paint", () => {
    const carousel = createCarousel(root, { items: items(12), startAt: 3 });
    expect(carousel.index()).toBe(3);
    expect(carousel.position()).toBe(3);
    const focused = root.querySelector<HTMLElement>(".cg-item[data-cg-focused] img");
    expect(focused?.getAttribute("src")).toBe("/img/3.webp");
    carousel.destroy();
  });

  it("wraps an opening card the new set does not have, or clamps it when not looping", () => {
    // Looping: position 9 of a 4-card loop is card 1, the same way the track
    // itself wraps — not a snap to the last card.
    const looping = createCarousel(root, { items: items(4), startAt: 9 });
    expect(looping.index()).toBe(1);
    looping.destroy();

    const negative = createCarousel(root, { items: items(4), startAt: -2 });
    expect(negative.index()).toBe(2);
    negative.destroy();

    const stopping = createCarousel(root, { items: items(4), startAt: 9, params: { loop: false } });
    expect(stopping.index()).toBe(3);
    stopping.destroy();
  });

  /**
   * A drifting ring's phase is between cards by nature, so a rebuild handed
   * one starts fractional — and the first parameter change on a snapping
   * carousel carries it the last half-card home, with its own easing.
   */
  it("takes a fractional start and settles it once snap applies", () => {
    const carousel = createCarousel(root, { items: items(8), startAt: 2.4, params: { snap: false } });
    expect(carousel.position()).toBeCloseTo(2.4, 9);

    // Still resting between cards while snap is off.
    carousel.setParams({ spacing: 300 });
    expect(carousel.position()).toBeCloseTo(2.4, 9);

    // Snap arrives (speed 0, so the settle lands at once): nearest card wins.
    carousel.setParams({ snap: true, speed: 0 });
    expect(carousel.position()).toBe(2);
    expect(carousel.index()).toBe(2);
    carousel.destroy();
  });

  /** The phase is the position plus drift — what `startAt` wants back. */
  it("reports its visual phase, wrapped to the card range", () => {
    const carousel = createCarousel(root, { items: items(6), startAt: 5 });
    // No drift: the phase is simply the position.
    expect(carousel.phase()).toBeCloseTo(5, 9);
    carousel.destroy();
  });
});

/** The x/y/z the controller actually wrote, pulled back out of the transform. */
function translate(el: HTMLElement): { x: number; y: number; z: number } {
  const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
  if (!m) throw new Error(`no translate3d in "${el.style.transform}"`);
  return { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
}

const visible = () => [...root.querySelectorAll<HTMLElement>(".cg-item")];

describe("rings and rows", () => {
  it("renders one full set per ring", () => {
    const carousel = createCarousel(root, {
      items: items(8),
      params: { rings: [{ scale: 1, drift: 0 }, { scale: 1.4, drift: 0 }, { scale: 1.8, drift: 0 }] },
    });
    expect(visible()).toHaveLength(24);
    carousel.destroy();
  });

  it("rebuilds when the number of rings changes, and only then", () => {
    const carousel = createCarousel(root, { items: items(6) });
    expect(visible()).toHaveLength(6);
    const stage = root.querySelector(".cg-stage");

    carousel.setParams({ rings: [{ scale: 1, drift: 0 }, { scale: 1.5, drift: 0 }] });
    expect(visible()).toHaveLength(12);
    expect(root.querySelector(".cg-stage")).toBe(stage); // the stage itself survives

    const nodes = visible();
    carousel.setParams({ curve: 0.4 });
    expect(visible()).toEqual(nodes); // a slider does not rebuild anything

    carousel.setParams({ rings: [{ scale: 1, drift: 0 }] });
    expect(visible()).toHaveLength(6);
    carousel.destroy();
  });

  it("puts an outer ring further out, around the same centre", () => {
    const carousel = createCarousel(root, {
      items: items(12),
      params: { curve: 0.5, rings: [{ scale: 1, drift: 0 }, { scale: 2, drift: 0 }] },
    });
    // The rings' shared centre sits one base radius into the screen. (The
    // stage's transform-origin is the middle of the *visible* extent, which is a
    // different thing on a half-open arc, and is the right pivot for the pitch.)
    const centre = -arcRadius(0.5, DEFAULT_PARAMS.spacing, 12);

    const all = visible();
    const inner = translate(all[1]);
    const outer = translate(all[13]);
    expect(Math.abs(outer.x)).toBeCloseTo(Math.abs(inner.x) * 2, 1);

    const radius = (t: { x: number; z: number }) => Math.hypot(t.x, t.z - centre);
    expect(radius(outer)).toBeCloseTo(radius(inner) * 2, 0);
    carousel.destroy();
  });

  // Neither engine's own answer covers the other's: Chromium sorts by depth
  // inside preserve-3d and ignores z-index there, Safari draws a screen-plane
  // arrangement in document order and takes z-index instead. Writing both, from
  // the same number, is the only thing that gets the same stack in both.
  it("gives every card a paint order that ranks the way its depth does", () => {
    const carousel = createCarousel(root, { items: items(12), params: { curve: 0.6 } });
    const read = () =>
      visible()
        .filter((el) => el.style.display !== "none")
        .map((el) => ({ z: translate(el).z, zIndex: Number(el.style.zIndex) }));

    for (const params of [{ curve: 0.6 }, { curve: 1, arcRotation: 90 }, { curve: 0.8, invert: true }]) {
      carousel.setParams(params);
      const cards = read();
      expect(cards.length, JSON.stringify(params)).toBeGreaterThan(2);
      for (const card of cards) expect(Number.isFinite(card.zIndex)).toBe(true);

      const byDepth = [...cards].sort((a, b) => a.z - b.z).map((c) => c.zIndex);
      const byIndex = [...cards].sort((a, b) => a.zIndex - b.zIndex).map((c) => c.zIndex);
      expect(byDepth, `${JSON.stringify(params)} — the two orders disagree`).toEqual(byIndex);
    }
    carousel.destroy();
  });

  /**
   * With no curve every card's depth is exactly zero, so the paint order was a
   * tie and the tie went to whichever card came later in the markup. On Flat fan
   * and Diagonal descent that put a half-faded neighbour over the focused card,
   * and you could see the front card through it.
   */
  it("keeps the focused card on top of a flat arrangement", () => {
    const carousel = createCarousel(root, {
      items: items(12),
      params: { curve: 0, depth: 0, cardAngle: 0, fadeFalloff: 0.3, spacing: 120, cardWidth: 200 },
    });

    const cards = visible()
      .filter((el) => el.style.display !== "none")
      .map((el) => ({ x: translate(el).x, zIndex: Number(el.style.zIndex) }));
    expect(cards.length).toBeGreaterThan(2);

    // The one nearest the middle of the track is the focused one, and nothing
    // may be painted over it.
    const focused = [...cards].sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
    const highest = Math.max(...cards.map((c) => c.zIndex));
    expect(focused.zIndex).toBe(highest);

    // And the rest fall away from it in order, rather than in markup order.
    const sorted = [...cards].sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].zIndex, `card ${i} out from centre`).toBeLessThanOrEqual(sorted[i - 1].zIndex);
    }
    carousel.destroy();
  });

  it("turns two rings opposite ways when their drift is opposite", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const carousel = createCarousel(root, {
      items: items(12),
      params: { curve: 0, spacing: 200, rings: [{ scale: 1, drift: 1 }, { scale: 1.5, drift: -1 }] },
    });
    const all = visible();
    expect(translate(all[0]).x).toBeCloseTo(0, 3);
    expect(translate(all[12]).x).toBeCloseTo(0, 3);

    vi.advanceTimersByTime(500);

    const forward = translate(all[0]).x;
    const backward = translate(all[12]).x;
    expect(Math.abs(forward)).toBeGreaterThan(10);
    expect(Math.abs(backward)).toBeGreaterThan(10);
    expect(Math.sign(forward)).toBe(-Math.sign(backward));

    carousel.destroy();
    vi.useRealTimers();
  });

  it("keeps asking for frames while anything drifts, and stops when nothing does", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const carousel = createCarousel(root, {
      items: items(6),
      params: { rings: [{ scale: 1, drift: 0.5 }] },
    });
    const first = visible()[1];
    const before = translate(first).x;
    vi.advanceTimersByTime(400);
    expect(translate(first).x).not.toBeCloseTo(before, 3);

    carousel.setParams({ rings: [{ scale: 1, drift: 0 }] });
    const parked = translate(visible()[1]).x;
    vi.advanceTimersByTime(1000);
    expect(translate(visible()[1]).x).toBeCloseTo(parked, 6);

    carousel.destroy();
    vi.useRealTimers();
  });

  it("splits the set across two rows, the second one lower down", () => {
    const carousel = createCarousel(root, {
      items: items(12),
      params: { curve: 0, bandRows: 2, cardWidth: 200, cardAspect: 1 },
    });
    const all = visible();
    const rowOne = all.slice(0, 6).map((el) => translate(el).y);
    const rowTwo = all.slice(6).map((el) => translate(el).y);
    expect(rowOne.every((y) => Math.abs(y) < 0.001)).toBe(true);
    expect(rowTwo.every((y) => y > 100)).toBe(true);
    // Each row is its own ring of six, so the arc still closes.
    expect(translate(all[6]).x).toBeCloseTo(translate(all[0]).x, 3);
    carousel.destroy();
  });
});

describe("the animation loop", () => {
  const fakeClock = () =>
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });

  afterEach(() => vi.useRealTimers());

  it("costs nothing at all while sitting still", () => {
    fakeClock();
    const request = vi.spyOn(window, "requestAnimationFrame");
    const carousel = createCarousel(root, { items: items(12) });
    vi.advanceTimersByTime(2000);
    expect(request).not.toHaveBeenCalled();
    carousel.destroy();
    request.mockRestore();
  });

  it("stops asking for frames the moment it settles", () => {
    fakeClock();
    const carousel = createCarousel(root, { items: items(12), params: { speed: 300, easing: "settle" } });
    const request = vi.spyOn(window, "requestAnimationFrame");

    carousel.next();
    vi.advanceTimersByTime(1000);
    const whileMoving = request.mock.calls.length;
    expect(whileMoving).toBeGreaterThan(5);
    expect(carousel.position()).toBe(1);

    vi.advanceTimersByTime(5000);
    expect(request.mock.calls.length).toBe(whileMoving);

    carousel.destroy();
    request.mockRestore();
  });

  it("hands the cards to the GPU only while they are moving", () => {
    // `will-change: transform` left on permanently is one promoted layer per
    // card sitting in GPU memory for a carousel doing nothing — forty of them on
    // the heaviest preset. It has to arrive with the movement and leave with it.
    fakeClock();
    const carousel = createCarousel(root, { items: items(12), params: { speed: 300 } });
    expect(root.dataset.cgMoving).toBeUndefined();

    carousel.next();
    expect(root.dataset.cgMoving).toBe("1");

    vi.advanceTimersByTime(1000);
    expect(carousel.position()).toBe(1);
    expect(root.dataset.cgMoving).toBeUndefined();

    carousel.destroy();
  });

  it("keeps the cards promoted for as long as a ring keeps drifting", () => {
    fakeClock();
    const carousel = createCarousel(root, { items: items(8), params: { rings: [{ scale: 1, drift: 0.5 }] } });
    vi.advanceTimersByTime(500);
    expect(root.dataset.cgMoving).toBe("1");
    carousel.destroy();
  });

  it("runs one loop for the instance, however much you poke it", () => {
    fakeClock();
    const carousel = createCarousel(root, { items: items(12), params: { speed: 400 } });
    const request = vi.spyOn(window, "requestAnimationFrame");
    carousel.next();
    carousel.next();
    carousel.goTo(5);
    carousel.prev();
    // Four moves in one tick must not stack up four loops.
    expect(request.mock.calls.length).toBe(1);
    carousel.destroy();
    request.mockRestore();
  });

  it("stops when scrolled out of the viewport and picks up again on return", () => {
    fakeClock();
    let notify: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    const observed: Element[] = [];
    const disconnect = vi.fn();
    class StubObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = callback;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", StubObserver);

    const carousel = createCarousel(root, {
      items: items(8),
      params: { rings: [{ scale: 1, drift: 1 }] },
    });
    expect(observed).toContain(root);

    const request = vi.spyOn(window, "requestAnimationFrame");
    vi.advanceTimersByTime(300);
    expect(request.mock.calls.length).toBeGreaterThan(2);

    notify!([{ isIntersecting: false }]);
    const whenGone = request.mock.calls.length;
    vi.advanceTimersByTime(2000);
    expect(request.mock.calls.length).toBe(whenGone);

    notify!([{ isIntersecting: true }]);
    vi.advanceTimersByTime(300);
    expect(request.mock.calls.length).toBeGreaterThan(whenGone);

    carousel.destroy();
    expect(disconnect).toHaveBeenCalled();
    request.mockRestore();
    vi.unstubAllGlobals();
  });

  it("does not fire autoplay the instant it comes back into view", () => {
    fakeClock();
    let notify: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    class StubObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", StubObserver);

    const carousel = createCarousel(root, {
      items: items(8),
      params: { autoplay: true, autoplayInterval: 1000, speed: 0 },
    });
    vi.advanceTimersByTime(800);
    notify!([{ isIntersecting: false }]);
    vi.advanceTimersByTime(9000);
    expect(carousel.index()).toBe(0);

    notify!([{ isIntersecting: true }]);
    vi.advanceTimersByTime(100);
    // The clock restarts rather than dumping nine seconds of backlog.
    expect(carousel.index()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(carousel.index()).toBe(1);

    carousel.destroy();
    vi.unstubAllGlobals();
  });

  it("finishes a move that was interrupted off-screen, without animating it", () => {
    fakeClock();
    let notify: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    class StubObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", StubObserver);

    const carousel = createCarousel(root, { items: items(12), params: { speed: 600 } });
    carousel.goTo(4);
    vi.advanceTimersByTime(100);
    notify!([{ isIntersecting: false }]);
    const stranded = carousel.position();
    expect(stranded).toBeGreaterThan(0);
    expect(stranded).toBeLessThan(4);

    vi.advanceTimersByTime(5000);
    expect(carousel.position()).toBe(stranded); // frozen while nobody is looking

    notify!([{ isIntersecting: true }]);
    vi.advanceTimersByTime(20);
    expect(carousel.position()).toBe(4); // and lands, rather than replaying

    carousel.destroy();
    vi.unstubAllGlobals();
  });
});

/**
 * Where a card actually lands on screen, carried through the same chain the
 * browser will: the stage's transform about its own origin, then the camera's
 * divide. Read out of the DOM rather than re-derived, so it tests what was
 * written and not what was meant.
 */
function project(el: HTMLElement): { x: number; y: number } {
  const stage = root.querySelector<HTMLElement>(".cg-stage")!;
  const t = stage.style.transform;
  const num = (pattern: RegExp) => {
    const m = pattern.exec(t);
    return m ? Number(m[1]) : 0;
  };
  const originZ = Number(/50% 50% (-?[\d.]+)px/.exec(stage.style.transformOrigin)?.[1] ?? 0);
  const shiftZ = num(/translateZ\((-?[\d.]+)px\)/);
  const zoom = num(/scale3d\((-?[\d.]+),/) || 1;
  const slideY = num(/translateY\((-?[\d.]+)px\)/);
  const pitch = (num(/rotateX\((-?[\d.]+)deg\)/) * Math.PI) / 180;
  const roll = (num(/rotateZ\((-?[\d.]+)deg\)/) * Math.PI) / 180;
  const distance = Number(/(-?[\d.]+)px/.exec(root.style.perspective)?.[1] ?? 1);

  // The point, relative to the stage's transform-origin.
  const p = translate(el);
  const v = { x: p.x, y: p.y, z: p.z - originZ };
  // rotateZ, then rotateX — rightmost applies first.
  const r1 = { x: v.x * Math.cos(roll) - v.y * Math.sin(roll), y: v.x * Math.sin(roll) + v.y * Math.cos(roll), z: v.z };
  const r2 = { x: r1.x, y: r1.y * Math.cos(pitch) - r1.z * Math.sin(pitch), z: r1.y * Math.sin(pitch) + r1.z * Math.cos(pitch) };
  // …then the slide, the zoom, and the depth the zoom has to make up.
  const world = { x: r2.x * zoom, y: (r2.y + slideY) * zoom, z: r2.z * zoom + originZ + shiftZ };
  const k = distance / (distance - world.z);
  return { x: world.x * k, y: world.y * k };
}

describe("zoom", () => {
  // The whole point of Zoom is that it is *not* Distance: it must change how much
  // of the frame the arrangement fills and leave the perspective alone. So every
  // card has to land at exactly the same place, multiplied.
  it("scales the whole picture and nothing else", () => {
    const params = { curve: 0.55, pitch: -22, tilt: 12, cardAngle: 40, distance: 1500 };
    const carousel = createCarousel(root, { items: items(12), params });

    const at = (zoom: number) => {
      carousel.setParams({ zoom });
      return visible()
        .filter((el) => el.style.display !== "none")
        .map(project);
    };

    const base = at(1);
    expect(base.length).toBeGreaterThan(4);

    // Relative, not absolute: the controller rounds what it writes to a
    // thousandth of a pixel, and at quarter zoom that rounding is the only error
    // left. A dolly — which is what this is guarding against — is out by percent.
    const off = (got: number, want: number) => Math.abs(got - want) / Math.max(1, Math.abs(want));

    for (const zoom of [0.25, 0.5, 1.75, 3]) {
      const scaled = at(zoom);
      expect(scaled).toHaveLength(base.length);
      scaled.forEach((point, i) => {
        expect(off(point.x, base[i].x * zoom), `card ${i} x at zoom ${zoom}`).toBeLessThan(1e-4);
        expect(off(point.y, base[i].y * zoom), `card ${i} y at zoom ${zoom}`).toBeLessThan(1e-4);
      });
    }
    carousel.destroy();
  });

  it("moves the camera with the scene, so the perspective is untouched", () => {
    const carousel = createCarousel(root, { items: items(8), params: { curve: 0.5, distance: 1600 } });
    const perspective = () => Number(/(-?[\d.]+)px/.exec(root.style.perspective)![1]);

    carousel.setParams({ zoom: 1 });
    expect(perspective()).toBeCloseTo(1600, 3);
    carousel.setParams({ zoom: 2.5 });
    expect(perspective()).toBeCloseTo(4000, 3);
    carousel.destroy();
  });

  it("leaves the scene alone at 1, which is what every style ships with", () => {
    const carousel = createCarousel(root, { items: items(8), params: { curve: 0.5, pitch: 20 } });
    const stage = root.querySelector<HTMLElement>(".cg-stage")!;
    expect(stage.style.transform).toContain("scale3d(1, 1, 1)");
    expect(stage.style.transform).toContain("translateZ(0px)");
    carousel.destroy();
  });
});
