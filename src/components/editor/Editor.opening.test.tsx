import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { PRESETS, presetParams } from "@/engine/presets";
import { Editor } from "./Editor";

/**
 * jsdom has no matchMedia, and the editor asks three questions through it: is
 * this a phone, is the drawer meant to be open, and has motion been turned down.
 *
 * Answering no to all three is a desktop with motion on, which is the case these
 * tests are about — the drawer is open, so the styles it lists are on screen to
 * be looked at. Stubbed here rather than in the shared setup: a global stub
 * would quietly answer for every test in the suite, including the ones that
 * stub matchMedia themselves to mean something.
 */
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Which style the drawer says you are on. The style buttons carry
 * `aria-pressed`, so the lit one is findable by the same thing a screen reader
 * would announce rather than by a class name that could change with the paint.
 */
const lit = (name: string) => screen.queryByRole("button", { name, pressed: true });

describe("the style the editor opens on", () => {
  it("opens on the first style when it is given none", () => {
    render(<Editor />);
    expect(lit(PRESETS[0].name)).not.toBeNull();
  });

  it("opens on the style it is named", () => {
    const asked = PRESETS[2];
    const { container } = render(<Editor openingSlug={asked.slug} />);
    expect(lit(asked.name)).not.toBeNull();
    expect(lit(PRESETS[0].name)).toBeNull();

    // Which chip is lit only says what the drawer thinks. The carousel is the
    // thing that was linked to, so it is asked separately: this style's seven
    // cards rather than the first one's fourteen, drawn at this style's own card
    // width. The count comes down from the slug and the width comes down from
    // the settings, which are two different ways of getting the opening wrong.
    expect(container.querySelectorAll(".cg-item")).toHaveLength(asked.cards);
    expect(container.querySelector<HTMLElement>(".cg-item")?.style.width).toBe(
      `${presetParams(asked.slug).cardWidth}px`,
    );
  });

  /**
   * The slug arrives off a web address, so it is whatever somebody typed. A name
   * that is not a style has to open on the first one — a mistyped link should
   * show a carousel, not an error page.
   */
  it("falls back to the first style when the name is not one", () => {
    render(<Editor openingSlug="not-a-style" />);
    expect(lit(PRESETS[0].name)).not.toBeNull();
  });
});
