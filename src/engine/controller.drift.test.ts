import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCarousel } from "./controller";
import type { CarouselItem, CarouselInstance } from "./controller";
import type { CarouselParams } from "./types";

/**
 * Steering a ring that is turning under you.
 *
 * The bug these are written against: tapping a card only ever spoke to the
 * shared position and never asked how far the ring's own drift had carried
 * things, so a tap landed exactly as many cards out as the drift had
 * travelled — and then kept turning past it. The answer is in two halves, and
 * both are checked here: aim at where the ring will be once it is still, and
 * stop turning long enough for the card to be worth looking at.
 */

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

function pointer(type: string, clientX: number, timeStamp: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX, clientY: 0, pointerId: 1, button: 0, isPrimary: true, pointerType: "mouse" });
  return at(event, timeStamp);
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
  });
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

const cardAt = (index: number) =>
  root.querySelectorAll<HTMLElement>(".cg-item")[index].querySelector<HTMLElement>(".cg-card")!;

/** A press and release on one card, with the pointer still: a tap. */
function tap(index: number) {
  cardAt(index).dispatchEvent(pointer("pointerdown", 300, 0));
  cardAt(index).dispatchEvent(pointer("pointerup", 300, 60));
}

/** Which card is nearest the middle on screen — drift and all. */
const showing = (carousel: CarouselInstance, n = 12) => {
  const phase = carousel.phase();
  return ((Math.round(phase) % n) + n) % n;
};

/** How far off centre the middle card is sitting, in cards. */
const offCentre = (carousel: CarouselInstance) => {
  const phase = carousel.phase();
  return Math.abs(phase - Math.round(phase));
};

const turning = (drift: number): Partial<CarouselParams> => ({
  speed: 0,
  tapToFocus: true,
  loop: true,
  rings: [{ scale: 1, drift }],
});

describe("aiming at a ring that is turning", () => {
  it("brings the tapped card to the middle after seconds of drift", () => {
    const carousel = mount(turning(0.5));
    // Four seconds at half a card a second: two cards of travel, which is
    // exactly how far out the tap used to land.
    vi.advanceTimersByTime(4000);
    tap(3);
    vi.advanceTimersByTime(2000);
    expect(showing(carousel)).toBe(3);
    expect(offCentre(carousel)).toBeLessThan(0.05);
  });

  it("works the same on a ring turning the other way", () => {
    const carousel = mount(turning(-0.5));
    vi.advanceTimersByTime(4000);
    tap(7);
    vi.advanceTimersByTime(2000);
    expect(showing(carousel)).toBe(7);
    expect(offCentre(carousel)).toBeLessThan(0.05);
  });

  it("picks the tapped card out of a second ring turning at its own rate", () => {
    mount(
      {
        speed: 0,
        tapToFocus: true,
        loop: true,
        rings: [{ scale: 1, drift: 0.5 }, { scale: 1.6, drift: -0.3 }],
      },
      8,
    );
    vi.advanceTimersByTime(3000);
    // Index 11 is card 3 of the second ring.
    tap(11);
    vi.advanceTimersByTime(2000);
    // Asserted on the card rather than on the position: the position that
    // centres a counter-turning ring is not the card's number and has no
    // reason to be — the ring is running backwards and carrying its own
    // offset. What has to be true is that the tapped card is the one in the
    // middle.
    const tapped = root.querySelectorAll<HTMLElement>(".cg-item")[11];
    expect(tapped.dataset.cgFocused).toBe("1");
  });

  it("steps one card on from what is on screen, not from the bare position", () => {
    const carousel = mount(turning(0.5));
    vi.advanceTimersByTime(4000);
    const before = showing(carousel);
    carousel.next();
    vi.advanceTimersByTime(2000);
    expect(showing(carousel)).toBe((before + 1) % 12);
  });

  it("reports the card that is actually in the middle", () => {
    const carousel = mount({ speed: 0, loop: true, rings: [{ scale: 1, drift: 0.5 }] });
    vi.advanceTimersByTime(4000);
    expect(carousel.index()).toBe(showing(carousel));
  });
});

describe("giving way, then taking over again", () => {
  it("holds the tapped card still rather than turning straight past it", () => {
    const carousel = mount(turning(0.5));
    vi.advanceTimersByTime(4000);
    tap(3);
    vi.advanceTimersByTime(1000);
    const settled = carousel.phase();
    // A second later — a whole half-card of drift, had it kept turning.
    vi.advanceTimersByTime(1000);
    expect(carousel.phase()).toBeCloseTo(settled, 3);
    expect(showing(carousel)).toBe(3);
  });

  it("starts turning again once it has been left alone", () => {
    const carousel = mount(turning(0.5));
    vi.advanceTimersByTime(4000);
    tap(3);
    vi.advanceTimersByTime(1500);
    const held = carousel.phase();
    // Past the hold and well into the wind-up.
    vi.advanceTimersByTime(5000);
    expect(carousel.phase()).not.toBeCloseTo(held, 2);
  });

  it("eases back in rather than snapping to full speed", () => {
    const carousel = mount(turning(0.5));
    tap(3);
    // Just past the hold: moving again, but nowhere near a full half-card a
    // second yet.
    vi.advanceTimersByTime(450 + 3000 + 200);
    const resuming = carousel.phase();
    vi.advanceTimersByTime(200);
    const travelled = Math.abs(carousel.phase() - resuming);
    expect(travelled).toBeGreaterThan(0);
    expect(travelled).toBeLessThan(0.5 * 0.2);
  });

  it("keeps its hands off a carousel that was never turning", () => {
    const carousel = mount({ speed: 0, tapToFocus: true, loop: true, rings: [{ scale: 1, drift: 0 }] });
    vi.advanceTimersByTime(4000);
    tap(3);
    expect(carousel.index()).toBe(3);
    expect(carousel.position()).toBe(3);
  });

  it("gives way to a drag as well as a tap", () => {
    const carousel = mount({ ...turning(0.5), drag: true, spacing: 200, snap: false });
    vi.advanceTimersByTime(4000);
    root.dispatchEvent(pointer("pointerdown", 0, 4000));
    root.dispatchEvent(pointer("pointermove", -200, 4040));
    root.dispatchEvent(pointer("pointerup", -200, 4080));
    // Two seconds is well past the end of the fling — its momentum decays on a
    // 320ms constant — and still inside the hold, so anything moving after
    // this is the drift having ignored the drag.
    vi.advanceTimersByTime(2000);
    const resting = carousel.phase();
    vi.advanceTimersByTime(800);
    expect(carousel.phase()).toBeCloseTo(resting, 2);
  });
});
