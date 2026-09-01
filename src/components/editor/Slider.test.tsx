import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { Slider } from "./Slider";

afterEach(cleanup);

const base = {
  id: "cg-curve",
  label: "Curve",
  min: 0,
  max: 1,
  step: 0.01,
  baseline: 0.14,
};

const input = () => screen.getByRole("slider") as HTMLInputElement;

describe("a slider", () => {
  it("shows its value to the precision its step implies", () => {
    render(<Slider {...base} value={0.4} onChange={() => {}} />);
    expect(screen.getByText("0.40")).toBeInTheDocument();
  });

  it("puts the mark where the value is, as a fraction of the range", () => {
    const { container } = render(<Slider {...base} value={0.25} onChange={() => {}} />);
    const capsule = container.querySelector(".cg-slider") as HTMLElement;
    expect(Number(capsule.style.getPropertyValue("--k"))).toBeCloseTo(0.25, 6);
  });

  it("offers a way back only once it has been moved off the style's value", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Slider {...base} value={0.14} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /reset curve/i })).toBeNull();

    rerender(<Slider {...base} value={0.4} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /reset curve/i }));
    expect(onChange).toHaveBeenCalledWith(0.14);
  });

  it("still takes a double-click back to the style's value", () => {
    const onChange = vi.fn();
    render(<Slider {...base} value={0.4} onChange={onChange} />);
    fireEvent.doubleClick(input());
    expect(onChange).toHaveBeenCalledWith(0.14);
  });

  /**
   * Eight pixels a step, so the number is the fine control and the track is the
   * coarse one. Without this a hundred-step dial is three pixels a step and
   * there is no way to land on a value on purpose.
   */
  it("scrubs the number a step at a time", () => {
    const onChange = vi.fn();
    render(<Slider {...base} value={0.5} onChange={onChange} />);
    const value = screen.getByText("0.50");

    fireEvent.pointerDown(value, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(value, { pointerId: 1, clientX: 124 });
    expect(onChange).toHaveBeenLastCalledWith(0.53);

    fireEvent.pointerMove(value, { pointerId: 1, clientX: 60 });
    expect(onChange).toHaveBeenLastCalledWith(0.45);
    fireEvent.pointerUp(value, { pointerId: 1 });
  });

  it("will not scrub past either end", () => {
    const onChange = vi.fn();
    render(<Slider {...base} value={0.98} onChange={onChange} />);
    const value = screen.getByText("0.98");
    fireEvent.pointerDown(value, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(value, { pointerId: 1, clientX: 800 });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("draws a centred dial with a middle to aim at and no fill", () => {
    const { container } = render(
      <Slider
        {...base}
        label="Pitch"
        min={-85}
        max={85}
        step={1}
        baseline={0}
        value={0}
        centred
        onChange={() => {}}
      />,
    );
    expect(container.querySelector(".cg-slider__centre")).not.toBeNull();
    expect(container.querySelector(".cg-slider__fill")).toBeNull();
  });

  it("takes a readout of its own where a bare number would not say enough", () => {
    render(
      <Slider {...base} value={0.4} onChange={() => {}} readout={(v) => `${v.toFixed(1)} →`} />,
    );
    expect(screen.getByText("0.4 →")).toBeInTheDocument();
  });
});
