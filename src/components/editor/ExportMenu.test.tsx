import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { IMAGES } from "@/data/images";
import { PRESETS, presetParams } from "@/engine/presets";
import { ExportMenu } from "./ExportMenu";

afterEach(cleanup);

const written: string[] = [];

beforeEach(() => {
  written.length = 0;
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard: {
      writeText: async (text: string) => {
        written.push(text);
      },
    },
  });
});

const menu = () =>
  render(
    <ExportMenu
      params={presetParams(PRESETS[0].slug)}
      items={IMAGES.slice(0, 6)}
      preset={PRESETS[0]}
      onPreset
    />,
  );

const openIt = () => fireEvent.click(screen.getByRole("button", { name: /export/i }));

describe("the export menu", () => {
  it("stays shut until it is asked for", () => {
    menu();
    expect(screen.queryByRole("menu")).toBeNull();
    openIt();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("copies the code, and says it did", async () => {
    menu();
    openIt();
    fireEvent.click(screen.getByRole("menuitem", { name: /^code/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toContain("<div");
    expect(written[0]).toContain("<script");
    await waitFor(() => expect(screen.getByText("Code Copied")).toBeInTheDocument());
  });

  // The prompt is prose for a model to read, not markup. If a <script> ever
  // turns up in it, the two outputs have been crossed.
  it("copies the prompt from the same menu", async () => {
    menu();
    openIt();
    fireEvent.click(screen.getByRole("menuitem", { name: /^prompt/i }));

    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toMatch(/^Build a 3D/);
    expect(written[0]).not.toContain("<script");
  });

  it("shuts on Escape and hands focus back", async () => {
    menu();
    const trigger = screen.getByRole("button", { name: /export/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("says how big each one is before you take it", () => {
    menu();
    openIt();
    const sizes = screen.getAllByText(/KB$/);
    expect(sizes).toHaveLength(2);
  });
});
