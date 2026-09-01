import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCarousel } from "./controller";
import type { CarouselItem, CarouselInstance } from "./controller";
import type { CarouselParams } from "./types";

const items = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `card ${i}` }));

let root: HTMLDivElement;
let live: CarouselInstance | null = null;

function mount(params: Partial<CarouselParams>, n = 12) {
  live = createCarousel(root, { items: items(n), params });
  return live;
}

/** timeStamp is a read-only accessor on Event.prototype, so it needs defining. */
function at(event: Event, timeStamp: number) {
  Object.defineProperty(event, "timeStamp", { value: timeStamp, configurable: true });
  return event;
}

/** jsdom has no PointerEvent worth using; the handlers only read these fields. */
function pointer(type: string, clientX: number, timeStamp: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, clientY: 0, pointerId: 1, button: 0, isPrimary: true, pointerType: "mouse" });
  return at(event, timeStamp);
}

/** A pointer event at an arbitrary point, for testing off-axis drags. */
function pointerXY(type: string, clientX: number, clientY: number, timeStamp: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, clientY, pointerId: 1, button: 0, isPrimary: true, pointerType: "mouse" });
  return at(event, timeStamp);
}

function wheel(deltaX: number, deltaY: number, timeStamp: number) {
  const event = new Event("wheel", { bubbles: true, cancelable: true });
  Object.assign(event, { deltaX, deltaY });
  return at(event, timeStamp);
}

const fakeClock = () =>
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
  });

function key(name: string) {
  return new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
}

/** Drag from 0 to `to` through the given samples, then let go. */
function drag(samples: { x: number; t: number }[]) {
  root.dispatchEvent(pointer("pointerdown", 0, 0));
  for (const s of samples) root.dispatchEvent(pointer("pointermove", s.x, s.t));
  const last = samples[samples.length - 1];
  root.dispatchEvent(pointer("pointerup", last.x, last.t));
}

beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});

afterEach(() => {
  live?.destroy();
  live = null;
  root.remove();
  document.getElementById("cg-styles")?.remove();
  vi.useRealTimers();
});

describe("drag", () => {
  it("moves one card for one step-width of travel", () => {
    const carousel = mount({ drag: true, spacing: 260, snap: false, speed: 0 });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointer("pointermove", -260, 16));
    expect(carousel.position()).toBeCloseTo(1, 3);
    root.dispatchEvent(pointer("pointermove", -130, 32));
    expect(carousel.position()).toBeCloseTo(0.5, 3);
  });

  it("follows the finger, not the other way round", () => {
    const carousel = mount({ drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointer("pointermove", 200, 16));
    // Dragging right brings earlier cards in, so the position goes back.
    expect(carousel.position()).toBeCloseTo(-1, 3);
  });

  it("lands a fast flick on a whole card when snapping", () => {
    fakeClock();
    const carousel = mount({ drag: true, spacing: 260, snap: true, speed: 200 });
    drag([
      { x: -60, t: 16 },
      { x: -140, t: 32 },
      { x: -240, t: 48 },
    ]);
    vi.advanceTimersByTime(3000);
    expect(Number.isInteger(carousel.position())).toBe(true);
    // Momentum carried it well past the card it was let go on.
    expect(carousel.position()).toBeGreaterThan(2);
  });

  it("does not read a stationary finger at release as a flick", () => {
    fakeClock();
    const carousel = mount({ drag: true, spacing: 260, snap: true, speed: 200 });
    // Fast to start with, then held still for a quarter of a second.
    drag([
      { x: -60, t: 16 },
      { x: -160, t: 32 },
      { x: -260, t: 48 },
      { x: -262, t: 150 },
      { x: -262, t: 260 },
      { x: -262, t: 300 },
    ]);
    vi.advanceTimersByTime(3000);
    // It was sitting on card 1 when released, so that is where it stays.
    expect(carousel.position()).toBe(1);
  });

  it("snaps to the nearest card when let go mid-way", () => {
    fakeClock();
    const carousel = mount({ drag: true, spacing: 200, snap: true, speed: 100 });
    drag([{ x: -130, t: 400 }]);
    vi.advanceTimersByTime(3000);
    expect(carousel.position()).toBe(1);
  });

  it("stays where it is dropped when snapping is off", () => {
    fakeClock();
    const carousel = mount({ drag: true, spacing: 200, snap: false, speed: 100 });
    drag([{ x: -130, t: 400 }]);
    vi.advanceTimersByTime(3000);
    expect(carousel.position()).toBeCloseTo(0.65, 2);
  });

  it("ignores the pointer entirely when drag is off", () => {
    const carousel = mount({ drag: false, spacing: 200 });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointer("pointermove", -400, 16));
    expect(carousel.position()).toBe(0);
  });
});

describe("tapping a card", () => {
  const cardAt = (index: number) =>
    root.querySelectorAll<HTMLElement>(".cg-item")[index].querySelector<HTMLElement>(".cg-card")!;

  it("brings the tapped card to the centre", () => {
    const carousel = mount({ speed: 0, tapToFocus: true }, 10);
    cardAt(3).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(3).dispatchEvent(pointer("pointerup", 302, 90));
    expect(carousel.index()).toBe(3);
  });

  it("does not treat the end of a drag as a tap", () => {
    const carousel = mount({ speed: 0, tapToFocus: true, snap: true, spacing: 200 }, 10);
    cardAt(3).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(3).dispatchEvent(pointer("pointermove", 180, 40));
    cardAt(3).dispatchEvent(pointer("pointerup", 180, 80));
    // Dragged 120px — that is a drag, and card 3 is not where it lands.
    expect(carousel.index()).not.toBe(3);
  });

  it("leaves the focused card alone", () => {
    const carousel = mount({ speed: 0, tapToFocus: true }, 10);
    cardAt(0).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(0).dispatchEvent(pointer("pointerup", 300, 60));
    expect(carousel.index()).toBe(0);
  });

  it("does nothing when the setting is off", () => {
    const carousel = mount({ speed: 0, tapToFocus: false }, 10);
    cardAt(4).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(4).dispatchEvent(pointer("pointerup", 300, 60));
    expect(carousel.index()).toBe(0);
  });

  it("still works when drag is switched off entirely", () => {
    const carousel = mount({ speed: 0, tapToFocus: true, drag: false }, 10);
    cardAt(5).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(5).dispatchEvent(pointer("pointerup", 300, 60));
    expect(carousel.index()).toBe(5);
  });

  it("picks the right card whichever ring it is in", () => {
    const carousel = mount(
      { speed: 0, tapToFocus: true, rings: [{ scale: 1, drift: 0 }, { scale: 1.6, drift: 0 }] },
      8,
    );
    // Index 11 is card 3 of the second ring.
    cardAt(11).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(11).dispatchEvent(pointer("pointerup", 300, 60));
    expect(carousel.index()).toBe(3);
  });

  it("reaches a card just behind the start by stepping back, not spinning forward", () => {
    const carousel = mount({ speed: 0, tapToFocus: true, loop: true }, 10);
    // On a loop, the last card sits one step to the left of the centre. A tap
    // on it means "one step back", not "nine steps forward".
    cardAt(9).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(9).dispatchEvent(pointer("pointerup", 300, 60));
    expect(carousel.index()).toBe(9);
    expect(carousel.position()).toBe(-1);
  });

  it("does not rewind the track once it has wrapped past the end", () => {
    const carousel = mount({ speed: 0, tapToFocus: true, loop: true }, 10);
    // Two full laps and a bit: card 3 is in the middle, showing its third copy.
    carousel.goTo(23);
    // Card 4 sits one step to the right. Tapping it moves one step on, rather
    // than rewinding nineteen cards to where the track began.
    cardAt(4).dispatchEvent(pointer("pointerdown", 300, 0));
    cardAt(4).dispatchEvent(pointer("pointerup", 300, 60));
    expect(carousel.index()).toBe(4);
    expect(carousel.position()).toBe(24);
  });
});

describe("which way the track runs", () => {
  // The scene's roll decides the track's direction on screen: 0 is horizontal,
  // 90 is vertical, anything between is diagonal. Input has to follow it, or a
  // vertical carousel is dragged sideways.
  it("reads a sideways drag on a horizontal track", () => {
    const carousel = mount({ tilt: 0, drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointerXY("pointermove", -200, 0, 16));
    expect(carousel.position()).toBeCloseTo(1, 3);
  });

  it("ignores a vertical drag on a horizontal track", () => {
    const carousel = mount({ tilt: 0, drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointerXY("pointermove", 0, -200, 16));
    expect(carousel.position()).toBeCloseTo(0, 3);
  });

  it("reads a vertical drag on a vertical track", () => {
    const carousel = mount({ tilt: 90, drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointerXY("pointermove", 0, -200, 16));
    expect(carousel.position()).toBeCloseTo(1, 3);
  });

  it("ignores a sideways drag on a vertical track", () => {
    const carousel = mount({ tilt: 90, drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointerXY("pointermove", -200, 0, 16));
    expect(carousel.position()).toBeCloseTo(0, 3);
  });

  it("reads the component along a diagonal track", () => {
    const carousel = mount({ tilt: -45, drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    // Straight along the track: left and down in equal measure.
    const along = 200 / Math.SQRT2;
    root.dispatchEvent(pointerXY("pointermove", -along, along, 16));
    expect(carousel.position()).toBeCloseTo(1, 2);

    // …and straight across it does nothing.
    root.dispatchEvent(pointerXY("pointermove", along, along, 32));
    expect(carousel.position()).toBeCloseTo(0, 2);
  });

  it("takes the down key on a vertical track and leaves it alone otherwise", () => {
    const vertical = mount({ tilt: 90, speed: 0 });
    root.dispatchEvent(key("ArrowDown"));
    expect(vertical.index()).toBe(1);
    root.dispatchEvent(key("ArrowUp"));
    expect(vertical.index()).toBe(0);
    vertical.destroy();
    live = null;

    // On a horizontal track the up and down keys belong to the page.
    const horizontal = mount({ tilt: 0, speed: 0 });
    const down = key("ArrowDown");
    root.dispatchEvent(down);
    expect(horizontal.index()).toBe(0);
    expect(down.defaultPrevented).toBe(false);
  });

  it("still takes left and right on a vertical track", () => {
    const carousel = mount({ tilt: 90, speed: 0 });
    root.dispatchEvent(key("ArrowRight"));
    expect(carousel.index()).toBe(1);
  });

  it("claims a vertical wheel on a vertical track, and only there", () => {
    const vertical = mount({ tilt: 90, wheel: true, speed: 0 });
    const down = wheel(0, 90, 100);
    root.dispatchEvent(down);
    expect(vertical.index()).toBe(1);
    expect(down.defaultPrevented).toBe(true);

    // A sideways flick across a vertical track is not ours.
    const sideways = wheel(120, 0, 600);
    root.dispatchEvent(sideways);
    expect(vertical.index()).toBe(1);
    expect(sideways.defaultPrevented).toBe(false);
  });
});

describe("keyboard", () => {
  it("can be tabbed to", () => {
    mount({});
    expect(root.getAttribute("tabindex")).toBe("0");
  });

  it("moves exactly one card on the arrow keys", () => {
    const carousel = mount({ speed: 0 });
    root.dispatchEvent(key("ArrowRight"));
    expect(carousel.index()).toBe(1);
    root.dispatchEvent(key("ArrowRight"));
    expect(carousel.index()).toBe(2);
    root.dispatchEvent(key("ArrowLeft"));
    expect(carousel.index()).toBe(1);
  });

  it("jumps to the ends on Home and End", () => {
    const carousel = mount({ speed: 0 }, 9);
    root.dispatchEvent(key("End"));
    expect(carousel.index()).toBe(8);
    root.dispatchEvent(key("Home"));
    expect(carousel.index()).toBe(0);
  });

  it("leaves other keys alone", () => {
    const carousel = mount({ speed: 0 });
    const event = key("a");
    root.dispatchEvent(event);
    expect(carousel.index()).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("arrows", () => {
  it("renders two buttons only when asked", () => {
    const carousel = mount({ arrows: false });
    expect(root.querySelectorAll(".cg-arrow")).toHaveLength(0);
    carousel.setParams({ arrows: true });
    expect(root.querySelectorAll(".cg-arrow")).toHaveLength(2);
    carousel.setParams({ arrows: false });
    expect(root.querySelectorAll(".cg-arrow")).toHaveLength(0);
  });

  it("moves one card per click", () => {
    const carousel = mount({ arrows: true, speed: 0 });
    const [prev, next] = root.querySelectorAll<HTMLButtonElement>(".cg-arrow");
    next.click();
    expect(carousel.index()).toBe(1);
    prev.click();
    expect(carousel.index()).toBe(0);
  });

  it("disables itself at the ends when not looping", () => {
    const carousel = mount({ arrows: true, loop: false, speed: 0 }, 4);
    const [prev, next] = root.querySelectorAll<HTMLButtonElement>(".cg-arrow");
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    carousel.goTo(3);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it("never disables itself when looping", () => {
    mount({ arrows: true, loop: true, speed: 0 }, 4);
    const [prev, next] = root.querySelectorAll<HTMLButtonElement>(".cg-arrow");
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });
});

describe("controls versus the drag", () => {
  // Found in a real browser: pressing an arrow started a drag on the root, the
  // root took pointer capture, and every later pointer event retargeted to it —
  // so the button never saw a pointerup and no click was ever generated. The
  // arrows silently did nothing. jsdom has no pointer capture, so the rule has
  // to be pinned on the behaviour instead: a press that lands on a control is
  // not a drag.
  it("does not start a drag when the press lands on an arrow", () => {
    const carousel = mount({ arrows: true, drag: true, spacing: 200, snap: false });
    const [, next] = root.querySelectorAll<HTMLButtonElement>(".cg-arrow");

    next.dispatchEvent(pointer("pointerdown", 0, 0));
    expect(root.getAttribute("data-cg-dragging")).toBeNull();

    next.dispatchEvent(pointer("pointermove", -400, 16));
    expect(carousel.position()).toBe(0);
  });

  it("does not start a drag when the press lands on a dot", () => {
    mount({ dots: true, drag: true });
    const dot = root.querySelector<HTMLButtonElement>(".cg-dot")!;
    dot.dispatchEvent(pointer("pointerdown", 0, 0));
    expect(root.getAttribute("data-cg-dragging")).toBeNull();
  });

  it("still lets the arrow move the carousel", () => {
    const carousel = mount({ arrows: true, drag: true, speed: 0 });
    const [prev, next] = root.querySelectorAll<HTMLButtonElement>(".cg-arrow");
    next.dispatchEvent(pointer("pointerdown", 0, 0));
    next.dispatchEvent(pointer("pointerup", 0, 8));
    next.click();
    expect(carousel.index()).toBe(1);
    prev.click();
    expect(carousel.index()).toBe(0);
  });

  it("still drags when the press lands on the carousel itself", () => {
    const carousel = mount({ arrows: true, drag: true, spacing: 200, snap: false });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    expect(root.getAttribute("data-cg-dragging")).toBe("1");
    root.dispatchEvent(pointer("pointermove", -200, 16));
    expect(carousel.position()).toBeCloseTo(1, 3);
  });
});

describe("dots", () => {
  it("renders one per card only when asked", () => {
    const carousel = mount({ dots: false }, 7);
    expect(root.querySelectorAll(".cg-dot")).toHaveLength(0);
    carousel.setParams({ dots: true });
    expect(root.querySelectorAll(".cg-dot")).toHaveLength(7);
  });

  it("caps at twelve for a longer set", () => {
    mount({ dots: true }, 25);
    expect(root.querySelectorAll(".cg-dot")).toHaveLength(12);
  });

  it("marks the current one and jumps when clicked", () => {
    const carousel = mount({ dots: true, speed: 0 }, 8);
    const dots = [...root.querySelectorAll<HTMLButtonElement>(".cg-dot")];
    expect(dots[0].getAttribute("aria-current")).toBe("true");
    dots[5].click();
    expect(carousel.index()).toBe(5);
    expect(dots[5].getAttribute("aria-current")).toBe("true");
    expect(dots[0].getAttribute("aria-current")).toBe("false");
  });
});

describe("autoplay", () => {
  it("advances after the interval and not before", () => {
    fakeClock();
    const carousel = mount({ autoplay: true, autoplayInterval: 1000, speed: 0 });
    expect(carousel.index()).toBe(0);
    vi.advanceTimersByTime(900);
    expect(carousel.index()).toBe(0);
    vi.advanceTimersByTime(200);
    expect(carousel.index()).toBe(1);
    vi.advanceTimersByTime(1050);
    expect(carousel.index()).toBe(2);
  });

  it("pauses while the pointer is over it", () => {
    fakeClock();
    const carousel = mount({ autoplay: true, autoplayInterval: 1000, pauseOnHover: true, speed: 0 });
    root.dispatchEvent(pointer("pointerenter", 0, 0));
    vi.advanceTimersByTime(3000);
    expect(carousel.index()).toBe(0);
    root.dispatchEvent(pointer("pointerleave", 0, 3000));
    vi.advanceTimersByTime(1100);
    expect(carousel.index()).toBe(1);
  });

  it("keeps going over a hover when pauseOnHover is off", () => {
    fakeClock();
    const carousel = mount({ autoplay: true, autoplayInterval: 1000, pauseOnHover: false, speed: 0 });
    root.dispatchEvent(pointer("pointerenter", 0, 0));
    vi.advanceTimersByTime(1100);
    expect(carousel.index()).toBe(1);
  });

  it("does nothing at all when off", () => {
    fakeClock();
    const carousel = mount({ autoplay: false, speed: 0 });
    vi.advanceTimersByTime(10000);
    expect(carousel.index()).toBe(0);
  });

  it("stops burning frames when the tab is hidden", () => {
    fakeClock();
    const carousel = mount({ autoplay: true, autoplayInterval: 500, speed: 0 });
    vi.advanceTimersByTime(600);
    expect(carousel.index()).toBe(1);

    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(5000);
    expect(carousel.index()).toBe(1);

    hidden.mockRestore();
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(600);
    expect(carousel.index()).toBe(2);
  });
});

describe("wheel", () => {
  it("attaches no wheel listener at all when off", () => {
    const spy = vi.spyOn(root, "addEventListener");
    mount({ wheel: false });
    expect(spy.mock.calls.filter((c) => c[0] === "wheel")).toHaveLength(0);
    spy.mockRestore();
  });

  it("attaches a non-passive one when on", () => {
    const spy = vi.spyOn(root, "addEventListener");
    mount({ wheel: true });
    const calls = spy.mock.calls.filter((c) => c[0] === "wheel");
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toMatchObject({ passive: false });
    spy.mockRestore();
  });

  it("adds and removes the listener as the toggle moves", () => {
    const add = vi.spyOn(root, "addEventListener");
    const remove = vi.spyOn(root, "removeEventListener");
    const carousel = mount({ wheel: false });
    carousel.setParams({ wheel: true });
    expect(add.mock.calls.filter((c) => c[0] === "wheel")).toHaveLength(1);
    carousel.setParams({ wheel: false });
    expect(remove.mock.calls.filter((c) => c[0] === "wheel")).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it("moves a card on a horizontal gesture, and only prevents default then", () => {
    const carousel = mount({ wheel: true, speed: 0 });
    const horizontal = wheel(90, 4, 100);
    root.dispatchEvent(horizontal);
    expect(carousel.index()).toBe(1);
    expect(horizontal.defaultPrevented).toBe(true);
  });

  it("leaves a vertical scroll alone — the page is not ours to hijack", () => {
    const carousel = mount({ wheel: true, speed: 0 });
    const vertical = wheel(2, 120, 100);
    root.dispatchEvent(vertical);
    expect(carousel.index()).toBe(0);
    expect(vertical.defaultPrevented).toBe(false);
  });

  it("waits out a cooldown rather than flying through the set", () => {
    const carousel = mount({ wheel: true, speed: 0 });
    for (let i = 0; i < 5; i++) root.dispatchEvent(wheel(90, 0, 100 + i * 10));
    expect(carousel.index()).toBe(1);
  });
});

describe("destroy, with listeners attached", () => {
  it("removes every one of them", () => {
    const targets = [root, window, document] as const;
    const added: string[] = [];
    const removed: string[] = [];
    const spies = targets.flatMap((target, i) => [
      vi.spyOn(target, "addEventListener").mockImplementation((type: string) => {
        added.push(`${i}:${type}`);
      }),
      vi.spyOn(target, "removeEventListener").mockImplementation((type: string) => {
        removed.push(`${i}:${type}`);
      }),
    ]);

    const carousel = createCarousel(root, {
      items: items(6),
      params: { drag: true, wheel: true, autoplay: true, arrows: true, dots: true },
    });
    carousel.destroy();
    live = null;

    spies.forEach((s) => s.mockRestore());
    expect(added.length).toBeGreaterThan(0);
    expect([...added].sort()).toEqual([...removed].sort());
  });

  it("takes the arrows and dots with it", () => {
    const carousel = createCarousel(root, { items: items(6), params: { arrows: true, dots: true } });
    expect(root.querySelectorAll(".cg-arrow, .cg-dot").length).toBeGreaterThan(0);
    carousel.destroy();
    live = null;
    expect(root.innerHTML).toBe("");
  });
});

/**
 * When the carousel takes the pointer, and why it waits.
 *
 * Pointer capture retargets every later pointer event for that pointer to the
 * element holding it, and a browser only synthesises a `click` where the press
 * and the release landed on the same element. Take capture on `pointerdown` and
 * that element is always the root — so the anchor a linked card is made of never
 * saw a click, and a carousel with real web addresses on its cards went nowhere
 * when you tapped one. No error, nothing in the console, and turning drag off
 * "fixed" it, which sends you hunting in entirely the wrong place.
 *
 * docs/web-build-gotchas.md carries this trap for buttons layered over a drag
 * surface, and its fix — decline the drag when the press starts on a control —
 * is what the arrows and dots already use. It cannot work for a card, because
 * the card *is* the drag surface. Waiting until the press has travelled far
 * enough to be a drag costs nothing instead: capture only matters once the
 * pointer leaves the element, which it cannot have done inside eight pixels.
 *
 * What is pinned here is the fix — *when* capture is taken. The symptom itself
 * cannot be reproduced in jsdom: hand-dispatched events establish no real
 * capture, so the broken version passes a synthetic test exactly as happily.
 * Only real input shows it, which is what e2e/links.spec.ts is for.
 */
describe("taking the pointer", () => {
  let taken: ReturnType<typeof vi.fn>;
  let given: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    taken = vi.fn();
    given = vi.fn();
    root.setPointerCapture = taken;
    root.releasePointerCapture = given;
  });

  it("does not take it on the press", () => {
    mount({ drag: true });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    expect(taken).not.toHaveBeenCalled();
  });

  it("has still not taken it inside the tap slop", () => {
    mount({ drag: true });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointer("pointermove", 8, 16));
    expect(taken).not.toHaveBeenCalled();
  });

  it("takes it once the press has travelled far enough to be a drag", () => {
    mount({ drag: true });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointer("pointermove", 20, 16));
    expect(taken).toHaveBeenCalledWith(1);
  });

  it("takes it once, not on every frame of the drag", () => {
    mount({ drag: true });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    for (const x of [20, 60, 120, 200]) root.dispatchEvent(pointer("pointermove", x, x));
    expect(taken).toHaveBeenCalledTimes(1);
  });

  it("gives it back when the drag ends", () => {
    mount({ drag: true });
    drag([{ x: 40, t: 16 }, { x: 90, t: 32 }]);
    expect(taken).toHaveBeenCalledTimes(1);
    expect(given).toHaveBeenCalledWith(1);
  });

  it("gives nothing back after a tap, having taken nothing", () => {
    mount({ drag: true });
    root.dispatchEvent(pointer("pointerdown", 0, 0));
    root.dispatchEvent(pointer("pointerup", 2, 16));
    expect(taken).not.toHaveBeenCalled();
    expect(given).not.toHaveBeenCalled();
  });
});
