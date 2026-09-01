import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS } from "@/engine/defaults";
import { editedKeys } from "./edited";

describe("spotting an edit", () => {
  it("finds nothing on an untouched style", () => {
    expect(editedKeys(DEFAULT_PARAMS, DEFAULT_PARAMS)).toEqual([]);
  });

  it("names the dials that moved", () => {
    const moved = { ...DEFAULT_PARAMS, curve: 0.9, dots: true };
    expect(editedKeys(moved, DEFAULT_PARAMS).sort()).toEqual(["curve", "dots"]);
  });

  // Rings are an array of objects, so === says "different" for two identical
  // rings. Compared by what they are rather than by which object they are.
  it("reads two identical rings as unchanged", () => {
    const same = { ...DEFAULT_PARAMS, rings: [{ scale: 1, drift: 0 }] };
    expect(editedKeys(same, DEFAULT_PARAMS)).toEqual([]);
  });

  it("notices a ring that was added or turned", () => {
    const more = {
      ...DEFAULT_PARAMS,
      rings: [
        { scale: 1, drift: 0 },
        { scale: 1.4, drift: 0 },
      ],
    };
    expect(editedKeys(more, DEFAULT_PARAMS)).toEqual(["rings"]);
  });
});
