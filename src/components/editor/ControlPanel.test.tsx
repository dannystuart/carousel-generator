import { describe, it, expect, afterEach } from "vitest";
import type { ComponentProps } from "react";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { DEFAULT_PARAMS } from "@/engine/defaults";
import { ControlPanel } from "./ControlPanel";

afterEach(cleanup);

const panel = (props: Partial<ComponentProps<typeof ControlPanel>> = {}) =>
  render(
    <ControlPanel
      params={DEFAULT_PARAMS}
      baseline={DEFAULT_PARAMS}
      onChange={() => {}}
      cards={12}
      query=""
      {...props}
    />,
  );

describe("the control panel", () => {
  it("keeps the six that matter in reach, with no fold to open", () => {
    panel();
    expect(screen.getByText("Curve")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /essentials/i })).toBeNull();
  });

  // One section starts open, so the folds are visibly folds rather than nine
  // identical rules somebody has to guess are clickable.
  it("opens one section to begin with, and folds the rest away", () => {
    panel();
    expect(screen.getByText("Pitch")).toBeInTheDocument();
    expect(screen.queryByText("Corner radius")).toBeNull();
  });

  it("keeps one open at a time, so the list never runs away", () => {
    panel();
    fireEvent.click(screen.getByRole("button", { name: /the cards/i }));
    expect(screen.getByText("Corner radius")).toBeInTheDocument();
    expect(screen.queryByText("Pitch")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /the cards/i }));
    expect(screen.queryByText("Corner radius")).toBeNull();
  });

  // An edit inside a folded section is an edit you cannot find. The dot is the
  // only thing standing between the visitor and hunting through nine folds.
  it("marks a fold that has something changed inside it", () => {
    panel({ params: { ...DEFAULT_PARAMS, pitch: 30 } });
    expect(
      screen.getByRole("button", { name: /camera/i }).querySelector("[data-edited]"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /the cards/i }).querySelector("[data-edited]"),
    ).toBeNull();
  });

  it("searches by what a control is called, and opens whatever holds it", () => {
    panel({ query: "blur" });
    expect(screen.getByText("Blur with distance")).toBeInTheDocument();
    expect(screen.queryByText("Curve")).toBeNull();
  });

  it("says so when a search finds nothing", () => {
    panel({ query: "kerning" });
    expect(screen.getByText(/no controls match/i)).toBeInTheDocument();
  });

  // Nine folds and forty dials, generated from one table — an empty section
  // would mean the table and the panel had drifted apart.
  it("draws every section the metadata declares", () => {
    panel();
    for (const title of [
      "Camera",
      "Arrangement",
      "The cards",
      "Distance effects",
      "Randomness",
      "Card content",
      "Movement",
      "What visitors can do",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(title, "i") })).toBeInTheDocument();
    }
  });
});
