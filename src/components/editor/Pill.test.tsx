import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { Pill } from "./Pill";

afterEach(cleanup);

const options = [
  { value: "panel", label: "Text panel" },
  { value: "button", label: "Button only" },
];

describe("a pill", () => {
  it("marks the live option and only that one", () => {
    render(<Pill label="Layout" options={options} value="button" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Button only" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Text panel" })).not.toBeChecked();
  });

  it("hands back the engine's word, not the one on screen", () => {
    const onChange = vi.fn();
    render(<Pill label="Layout" options={options} value="panel" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Button only" }));
    expect(onChange).toHaveBeenCalledWith("button");
  });

  /**
   * One highlight that slides, not a background swapped on and off two buttons —
   * so the change reads as a single object moving.
   */
  it("positions one highlight over the live option", () => {
    const { container } = render(
      <Pill label="Layout" options={options} value="button" onChange={() => {}} />,
    );
    const group = container.querySelector(".cg-pill") as HTMLElement;
    expect(group.style.getPropertyValue("--i")).toBe("1");
    expect(group.style.getPropertyValue("--n")).toBe("2");
    expect(container.querySelectorAll(".cg-pill__lit")).toHaveLength(1);
  });

  it("is named for a screen reader by the thing it sets", () => {
    render(<Pill label="Layout" options={options} value="panel" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Layout" })).toBeInTheDocument();
  });

  // An unlit pill reads as broken rather than as unset.
  it("lights the first option rather than none when the value is a stranger", () => {
    const { container } = render(
      <Pill label="Layout" options={options} value="mystery" onChange={() => {}} />,
    );
    expect((container.querySelector(".cg-pill") as HTMLElement).style.getPropertyValue("--i")).toBe("0");
  });
});
