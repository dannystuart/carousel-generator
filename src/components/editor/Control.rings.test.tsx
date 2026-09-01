import { describe, it, expect, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { DEFAULT_PARAMS } from "@/engine/defaults";
import type { CarouselParams, RingSpec } from "@/engine/types";
import { Control } from "./Control";

afterEach(cleanup);

/**
 * The ring controls, driven the way the editor drives them — through state, so a
 * value the control refuses to take is a value that comes straight back.
 */
function Rings({ rings, onRings }: { rings: RingSpec[]; onRings?: (next: RingSpec[]) => void }) {
  const [params, setParams] = useState<CarouselParams>({ ...DEFAULT_PARAMS, curve: 1, rings });
  return (
    <Control
      name="rings"
      params={params}
      baseline={DEFAULT_PARAMS}
      cards={12}
      onChange={(patch) => {
        setParams((current) => ({ ...current, ...patch }));
        if (patch.rings) onRings?.(patch.rings);
      }}
    />
  );
}

const turn = (n: number) => screen.getByLabelText(`Ring ${n} turn`) as HTMLInputElement;
const two: RingSpec[] = [{ scale: 1, drift: 0 }, { scale: 1.5, drift: 0 }];

describe("the ring controls", () => {
  it("says which way a ring is turning, and when it is not", () => {
    render(<Rings rings={[{ scale: 1, drift: 0 }, { scale: 1.5, drift: -0.4 }]} />);
    // The base ring's size is stated rather than offered: it is 1 by definition.
    expect(screen.queryByLabelText("Ring 1 size")).toBeNull();
    expect(screen.getByLabelText("Ring 2 size")).toBeInTheDocument();

    expect(screen.getByText("still")).toBeInTheDocument();
    expect(screen.getByText("0.40 ←")).toBeInTheDocument();

    fireEvent.change(turn(2), { target: { value: "0.4" } });
    expect(screen.getByText("0.40 →")).toBeInTheDocument();
  });

  /**
   * A ring turns one way below zero and the other above it, so "not turning" is a
   * single point in the middle of a slider three units wide — about a pixel of
   * track. Danny, having nudged one: "I couldn't get it back to zero where it
   * wasn't moving at all even though I was trying to find the middle point."
   */
  it("comes to a dead stop anywhere near the middle", () => {
    const onRings = vi.fn();
    render(<Rings rings={two} onRings={onRings} />);

    for (const nudge of ["0.05", "-0.05", "0.01", "-0.03"]) {
      fireEvent.change(turn(2), { target: { value: nudge } });
      expect(onRings.mock.lastCall?.[0][1].drift, `${nudge} should read as stopped`).toBe(0);
    }
    // …without swallowing a speed anyone would actually want.
    for (const real of ["0.06", "-0.5", "1.5"]) {
      fireEvent.change(turn(2), { target: { value: real } });
      expect(onRings.mock.lastCall?.[0][1].drift, real).toBeCloseTo(Number(real), 6);
    }
  });

  // The trap in the line above: an arrow key moves one step, one step is inside
  // the detent, so a keyboard would set 0.01, have it rounded back to 0, and
  // never get a stopped ring moving again.
  it("still lets the keyboard start a stopped ring", () => {
    const onRings = vi.fn();
    render(<Rings rings={two} onRings={onRings} />);

    fireEvent.keyDown(turn(2), { key: "ArrowRight" });
    const started = onRings.mock.lastCall?.[0][1].drift as number;
    expect(started).toBeGreaterThan(0);
    expect(started, "and not somewhere the detent will drag it back from").toBe(
      Number(turn(2).value),
    );

    fireEvent.keyDown(turn(2), { key: "ArrowLeft" });
    // Already moving, so the arrow key is the browser's own again.
    expect(onRings).toHaveBeenCalledTimes(1);
  });

  it("takes a ring back to a stop on a double-click", () => {
    const onRings = vi.fn();
    render(<Rings rings={[{ scale: 1, drift: 0 }, { scale: 1.5, drift: 0.8 }]} onRings={onRings} />);
    fireEvent.doubleClick(turn(2));
    expect(onRings.mock.lastCall?.[0][1].drift).toBe(0);
  });

  /**
   * A dial whose halves mean opposite things gets a marker that moves out from
   * the middle, not a fill from the left end — a lit length from the end would
   * read as "how much" on a control where the left half means "the other way".
   */
  it("puts the marker either side of a middle you can aim at", () => {
    const { container } = render(
      <Rings rings={[{ scale: 1, drift: 0 }, { scale: 1.5, drift: 0.75 }]} />,
    );
    const capsules = container.querySelectorAll(".cg-slider");
    const capsule = capsules[capsules.length - 1] as HTMLElement;

    // 0.75 of 1.5 either way is three quarters of the way along the track.
    expect(Number(capsule.style.getPropertyValue("--k"))).toBeCloseTo(0.75, 6);
    expect(capsule.querySelector(".cg-slider__centre")).not.toBeNull();
    expect(capsule.querySelector(".cg-slider__fill")).toBeNull();

    fireEvent.change(turn(2), { target: { value: "-0.75" } });
    const after = container.querySelectorAll(".cg-slider");
    expect(
      Number((after[after.length - 1] as HTMLElement).style.getPropertyValue("--k")),
    ).toBeCloseTo(0.25, 6);
  });
});
