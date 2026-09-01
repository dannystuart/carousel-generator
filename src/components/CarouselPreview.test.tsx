import { describe, it, expect, afterEach } from "vitest";
import { StrictMode } from "react";
import { render, cleanup } from "@testing-library/react";
import { CarouselPreview } from "./CarouselPreview";
import type { CarouselItem } from "@/engine/controller";
import type { CarouselParams } from "@/engine/types";

const items = (n: number): CarouselItem[] =>
  Array.from({ length: n }, (_, i) => ({ src: `/img/${i}.webp`, alt: `card ${i}` }));

afterEach(() => {
  cleanup();
  document.getElementById("cg-styles")?.remove();
});

const host = (container: HTMLElement) => container.querySelector<HTMLElement>(".cg-root")!;
const cards = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".cg-item")];

describe("CarouselPreview", () => {
  it("mounts the real engine, not a React reimplementation of it", () => {
    const { container } = render(<CarouselPreview items={items(6)} params={{}} />);
    expect(host(container)).not.toBeNull();
    expect(cards(container)).toHaveLength(6);
    expect(cards(container)[0].style.transform).toMatch(/translate3d\(/);
  });

  it("survives StrictMode's mount, cleanup, mount", () => {
    // The double-invoke is the whole point: if destroy() were incomplete,
    // createCarousel would throw on the second mount rather than quietly
    // doubling the cards.
    const { container } = render(
      <StrictMode>
        <CarouselPreview items={items(5)} params={{}} />
      </StrictMode>,
    );
    expect(container.querySelectorAll(".cg-stage")).toHaveLength(1);
    expect(cards(container)).toHaveLength(5);
  });

  it("restyles rather than remounting when a slider moves", () => {
    const { container, rerender } = render(
      <CarouselPreview items={items(8)} params={{ curve: 0, spacing: 200 }} />,
    );
    const before = cards(container);
    const stage = container.querySelector(".cg-stage");
    const transform = before[1].style.transform;

    rerender(<CarouselPreview items={items(8)} params={{ curve: 0, spacing: 420 }} />);

    expect(container.querySelector(".cg-stage")).toBe(stage);
    expect(cards(container)).toEqual(before);
    expect(before[1].style.transform).not.toBe(transform);
  });

  it("keeps its place across a slider move", () => {
    const { container, rerender } = render(
      <CarouselPreview items={items(12)} params={{ speed: 0, cardAngle: 0 }} />,
    );
    host(container).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    host(container).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    const focused = /translate3d\(0px, 0px, 0px\).*scale\(1\)/;
    expect(cards(container)[2].style.transform).toMatch(focused);
    const neighbour = cards(container)[3].style.transform;

    rerender(<CarouselPreview items={items(12)} params={{ speed: 0, cardAngle: 40 }} />);

    // Card 2 is still the focused one — a remount would have snapped back to
    // the first — while its neighbour has picked up the new angle.
    expect(cards(container)[2].style.transform).toMatch(focused);
    expect(cards(container)[0].style.transform).not.toMatch(focused);
    expect(cards(container)[3].style.transform).not.toBe(neighbour);
    expect(cards(container)[3].style.transform).toMatch(/rotateY\(-2[0-9.]+deg\)/);
  });

  it("does not remount for a fresh array holding the same pictures", () => {
    const { container, rerender } = render(<CarouselPreview items={items(6)} params={{}} />);
    const before = cards(container);
    rerender(<CarouselPreview items={items(6)} params={{}} />);
    expect(cards(container)).toEqual(before);
  });

  it("does remount when the pictures genuinely change", () => {
    const { container, rerender } = render(<CarouselPreview items={items(6)} params={{}} />);
    rerender(<CarouselPreview items={items(9)} params={{}} />);
    expect(cards(container)).toHaveLength(9);
    expect(container.querySelectorAll(".cg-stage")).toHaveLength(1);
  });

  it("cleans up completely on unmount", () => {
    const { container, unmount } = render(<CarouselPreview items={items(6)} params={{}} />);
    const mountPoint = container.firstElementChild as HTMLElement;
    unmount();
    expect(mountPoint.innerHTML).toBe("");
    expect(mountPoint.classList.contains("cg-root")).toBe(false);
  });

  it("hands the instance out so an editor can drive it", () => {
    let captured: { next(): void; index(): number } | null = null;
    const { container } = render(
      <CarouselPreview items={items(10)} params={{ speed: 0 }} onReady={(i) => (captured = i)} />,
    );
    expect(captured).not.toBeNull();
    captured!.next();
    expect(captured!.index()).toBe(1);
    expect(cards(container)).toHaveLength(10);
  });

  it("passes className and style through to the host", () => {
    const params: Partial<CarouselParams> = {};
    const { container } = render(
      <CarouselPreview items={items(4)} params={params} className="tall" style={{ height: "480px" }} />,
    );
    expect(host(container).classList.contains("tall")).toBe(true);
    expect(host(container).style.height).toBe("480px");
  });
});
