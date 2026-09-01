import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCarousel } from "./controller";
import type { CarouselItem } from "./controller";
import type { CarouselParams } from "./types";

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

const plain = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `card ${i}` }));

const rich = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({
    src: `/img/${i}.webp`,
    alt: `card ${i}`,
    href: `https://example.com/${i}`,
    title: `Project ${i}`,
    caption: `What it was`,
    cta: "View",
  }));

/**
 * A carousel of pictures that go nowhere is a screensaver. Cards can carry a
 * link, a title, a caption and a button, and reveal them on focus or on hover —
 * which is what turns this from something pretty into something a person can
 * actually ship on a portfolio or a product page.
 */
describe("card content", () => {
  it("stays a plain picture when there is nothing to add", () => {
    const carousel = createCarousel(root, { items: plain(4) });
    const card = root.querySelector(".cg-card")!;
    expect(card.tagName).toBe("DIV");
    expect(card.querySelector(".cg-content")).toBeNull();
    expect(card.querySelectorAll("img")).toHaveLength(1);
    carousel.destroy();
  });

  it("becomes a real link when the card has a web address and something to show", () => {
    const carousel = createCarousel(root, { items: rich(3), params: { cardReveal: "focus" } });
    const card = root.querySelector(".cg-card") as HTMLAnchorElement;
    expect(card.tagName).toBe("A");
    expect(card.getAttribute("href")).toBe("https://example.com/0");
    // Dragging a link is the browser's own gesture and would fight ours.
    expect(card.draggable).toBe(false);
    carousel.destroy();
  });

  it("writes only the pieces a card actually has", () => {
    const carousel = createCarousel(root, {
      items: [
        { src: "/a.webp", alt: "a", title: "Only a title" },
        { src: "/b.webp", alt: "b" },
      ],
    });
    const [first, second] = root.querySelectorAll(".cg-card");
    expect(first.querySelector(".cg-title")?.textContent).toBe("Only a title");
    expect(first.querySelector(".cg-caption")).toBeNull();
    expect(first.querySelector(".cg-cta")).toBeNull();
    expect(second.querySelector(".cg-content")).toBeNull();
    carousel.destroy();
  });

  it("marks the focused card, so the reveal is one CSS rule and not a rebuild", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const carousel = createCarousel(root, {
      items: rich(5),
      params: { cardReveal: "focus", speed: 200 },
    });
    const focused = () =>
      [...root.querySelectorAll(".cg-item")].findIndex(
        (item) => (item as HTMLElement).dataset.cgFocused === "1",
      );
    expect(focused()).toBe(0);
    carousel.goTo(3);
    vi.advanceTimersByTime(600);
    expect(focused()).toBe(3);
    expect(root.querySelectorAll("[data-cg-focused]")).toHaveLength(1);
    carousel.destroy();
    vi.useRealTimers();
  });

  it("says on the root when the content should show, so nothing is hidden by rebuilding", () => {
    const carousel = createCarousel(root, { items: rich(4), params: { cardReveal: "hover" } });
    expect(root.dataset.cgReveal).toBe("hover");
    carousel.setParams({ cardReveal: "never" });
    expect(root.dataset.cgReveal).toBe("never");
    // The content stays in the markup either way — it is a screen reader's only
    // route to the card's title, and hiding it by removing it would take that away.
    expect(root.querySelector(".cg-title")).not.toBeNull();
    carousel.destroy();
  });

  it("keeps the link out of the way of the carousel's own gestures", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "Date", "setTimeout", "clearTimeout"],
    });
    const carousel = createCarousel(root, {
      items: rich(5),
      params: { tapToFocus: true, speed: 200, cardReveal: "focus" },
    });
    const items = [...root.querySelectorAll(".cg-item")] as HTMLElement[];

    // A press and release on a card that is not focused means "bring that one
    // here" — following its link instead would take the visitor off the page
    // when all they did was look at the next picture.
    const away = items[2].querySelector(".cg-card")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    away.dispatchEvent(click);
    expect(click.defaultPrevented, "a side card's link must not fire").toBe(true);

    carousel.goTo(2);
    vi.advanceTimersByTime(1200);
    const onFocused = new MouseEvent("click", { bubbles: true, cancelable: true });
    away.dispatchEvent(onFocused);
    expect(onFocused.defaultPrevented, "the focused card's link must work").toBe(false);
    carousel.destroy();
    vi.useRealTimers();
  });

  it("does not follow a link that was really the end of a drag", () => {
    // Links always live and tap-to-centre off, so the drag rule is the only
    // thing that can stop this one — otherwise the test passes for the wrong
    // reason the moment either of the others would have caught it too.
    const carousel = createCarousel(root, {
      items: rich(5),
      params: { cardLink: "always", tapToFocus: false },
    });
    const card = root.querySelector(".cg-card")!;

    root.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 400, clientY: 300, pointerId: 1 }),
    );
    root.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 250, clientY: 300, pointerId: 1 }),
    );
    root.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX: 250, clientY: 300, pointerId: 1 }),
    );

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    card.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    carousel.destroy();
  });
});

/**
 * Two ways to lay the revealed content out: the text panel along the bottom,
 * or nothing but the button, centred. The stylesheet does the actual laying
 * out; the engine's whole job is to tell it which one is in force.
 */
describe("content layout", () => {
  it("defaults to the text panel", () => {
    const carousel = createCarousel(root, { items: rich(3) });
    expect(root.dataset.cgContent).toBe("panel");
    carousel.destroy();
  });

  it("tells the stylesheet which layout is in force, and follows updates", () => {
    const carousel = createCarousel(root, {
      items: rich(3),
      params: { contentLayout: "button" },
    });
    expect(root.dataset.cgContent).toBe("button");
    carousel.setParams({ contentLayout: "panel" });
    expect(root.dataset.cgContent).toBe("panel");
    carousel.destroy();
  });

  it("scales the button through a stylesheet variable, like the reveal zoom", () => {
    const carousel = createCarousel(root, {
      items: rich(3),
      params: { buttonScale: 1.4 },
    });
    expect(root.style.getPropertyValue("--cg-cta-scale")).toBe("1.4");
    carousel.setParams({ buttonScale: 1 });
    expect(root.style.getPropertyValue("--cg-cta-scale")).toBe("1");
    carousel.destroy();
  });

  it("scales the words the same way", () => {
    const carousel = createCarousel(root, { items: rich(3), params: { textScale: 0.8 } });
    expect(root.style.getPropertyValue("--cg-text-scale")).toBe("0.8");
    carousel.setParams({ textScale: 1.5 });
    expect(root.style.getPropertyValue("--cg-text-scale")).toBe("1.5");
    carousel.destroy();
  });

  it("opens in a new tab only where the card asks for it", () => {
    const carousel = createCarousel(root, {
      items: [
        { src: "a.webp", alt: "a", href: "https://example.com", newTab: true },
        { src: "b.webp", alt: "b", href: "https://example.com" },
      ],
    });
    const [away, same] = Array.from(root.querySelectorAll("a.cg-card")) as HTMLAnchorElement[];
    expect(away.target).toBe("_blank");
    // `noopener` is the load-bearing half of that pair: without it the page we
    // open can reach back through `window.opener` and navigate ours.
    expect(away.rel).toBe("noopener noreferrer");
    expect(same.target).toBe("");
    expect(same.rel).toBe("");
    carousel.destroy();
  });
});

/**
 * A card with nothing on it shows no sign that it can be clicked, so under the
 * default it is not a link — not a link that declines to fire. The difference is
 * everything for anyone not looking at it: a dead anchor is still announced as a
 * link and still lands in the tab order, which is a promise the carousel then
 * breaks. Reported by Danny on 12 Aug 2026, having been walked off the tool by a
 * card that looked like a photograph.
 */
describe("when a card actually links", () => {
  const href = () => root.querySelector(".cg-card")!.getAttribute("href");

  it("stays a picture while it has nothing to show", () => {
    // The shipped default: content never shows, so nothing is clickable.
    const carousel = createCarousel(root, { items: rich(3) });
    expect(href()).toBeNull();
    carousel.destroy();
  });

  it("takes its address the moment its words are given a way to show", () => {
    const carousel = createCarousel(root, { items: rich(3) });
    expect(href()).toBeNull();
    carousel.setParams({ cardReveal: "focus" });
    expect(href()).toBe("https://example.com/0");
    carousel.setParams({ cardReveal: "never" });
    expect(href()).toBeNull();
    carousel.destroy();
  });

  it("links regardless on Always, for a wall of pictures with no words on it", () => {
    const carousel = createCarousel(root, {
      items: rich(3),
      params: { cardLink: "always", cardReveal: "never" },
    });
    expect(href()).toBe("https://example.com/0");
    carousel.destroy();
  });

  it("never links on Never, whatever the content is doing", () => {
    const carousel = createCarousel(root, {
      items: rich(3),
      params: { cardLink: "never", cardReveal: "both" },
    });
    expect(href()).toBeNull();
    carousel.destroy();
  });

  it("keeps the element an anchor, so the address is not lost on the way", () => {
    // Toggled by attribute rather than by rebuilding the card: an <a> with no
    // href is already not a link, and rebuilding would drop the loaded picture.
    const carousel = createCarousel(root, { items: rich(3) });
    const before = root.querySelector(".cg-card")!;
    expect(before.tagName).toBe("A");
    carousel.setParams({ cardReveal: "hover" });
    expect(root.querySelector(".cg-card")).toBe(before);
    expect(before.getAttribute("href")).toBe("https://example.com/0");
    carousel.destroy();
  });

  it("leaves a card with no address alone in every mode", () => {
    const carousel = createCarousel(root, {
      items: [{ src: "a.webp", alt: "a", title: "Just a picture" }],
      params: { cardLink: "always", cardReveal: "both" },
    });
    expect(root.querySelector(".cg-card")!.tagName).toBe("DIV");
    carousel.destroy();
  });

  /**
   * With the reveal set to Centred every card is a link — they all reveal when
   * their turn comes, and dropping the others out of the tab order as the
   * carousel turned would be a page whose links move about. Only the centred one
   * is showing anything, so only the centred one may travel.
   */
  it("only lets the card that is actually showing its words travel", () => {
    const carousel = createCarousel(root, {
      items: rich(5),
      params: { cardReveal: "focus", tapToFocus: false },
    });
    const cards = [...root.querySelectorAll(".cg-card")] as HTMLElement[];
    // Every one of them is a link, so none of them moves about in the tab order.
    expect(cards.every((card) => card.hasAttribute("href"))).toBe(true);

    const clickOn = (card: HTMLElement) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      card.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(clickOn(cards[0]), "the centred card should travel").toBe(false);
    expect(clickOn(cards[2]), "a card showing nothing should not").toBe(true);
    carousel.destroy();
  });

  it("lets any card travel on hover, because the one you clicked is the one showing", () => {
    const carousel = createCarousel(root, {
      items: rich(5),
      params: { cardReveal: "hover", tapToFocus: false },
    });
    const cards = [...root.querySelectorAll(".cg-card")] as HTMLElement[];
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    cards[2].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    carousel.destroy();
  });

  it("tells the stylesheet which way it is set", () => {
    const carousel = createCarousel(root, { items: rich(3), params: { cardLink: "always" } });
    expect(root.dataset.cgLink).toBe("always");
    carousel.setParams({ cardLink: "never" });
    expect(root.dataset.cgLink).toBe("never");
    carousel.destroy();
  });
});

/**
 * The panel used to be fixed pixels while the card was a slider, so shrinking
 * the card left 15px type on a card too small to hold it — at the narrowest
 * setting the words stood two thirds taller than the card and most of them were
 * cropped away. Everything in the panel is now drawn against this one number.
 */
describe("sizing the content panel against the card", () => {
  const fit = () => Number(root.style.getPropertyValue("--cg-fit"));

  const mount = (params: Partial<CarouselParams>) =>
    createCarousel(root, { items: rich(3), params });

  it("draws it at full size on the card its numbers were tuned for", () => {
    const carousel = mount({ cardWidth: 320, cardAspect: 1.32 });
    expect(fit()).toBeCloseTo(1, 3);
    carousel.destroy();
  });

  it("shrinks it with the card, so the words keep their share of the picture", () => {
    const carousel = mount({ cardWidth: 160, cardAspect: 1.32 });
    expect(fit()).toBeCloseTo(0.5, 3);
    carousel.destroy();
  });

  it("follows whichever dimension is the tighter of the two", () => {
    // Full width, half the height. A squat card crops a bottom panel every bit
    // as readily as a narrow one, and the shape slider reaches 0.5.
    const carousel = mount({ cardWidth: 320, cardAspect: 0.66 });
    expect(fit()).toBeCloseTo(0.5, 3);
    carousel.destroy();
  });

  it("never draws it larger than it was tuned, however big the card gets", () => {
    const carousel = mount({ cardWidth: 600, cardAspect: 2.5 });
    expect(fit()).toBe(1);
    carousel.destroy();
  });

  it("follows the card as it is resized", () => {
    const carousel = mount({ cardWidth: 320, cardAspect: 1.32 });
    expect(fit()).toBeCloseTo(1, 3);
    carousel.setParams({ cardWidth: 80 });
    expect(fit()).toBeCloseTo(0.25, 3);
    carousel.destroy();
  });
});
