import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS, PARAM_GROUPS, PARAM_META } from "./defaults";

describe("defaults", () => {
  it("every parameter has editor metadata", () => {
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      expect(PARAM_META[key as keyof typeof DEFAULT_PARAMS], `missing meta for ${key}`).toBeDefined();
    }
  });

  it("every numeric default sits inside its declared range", () => {
    for (const [key, meta] of Object.entries(PARAM_META)) {
      if (meta.kind !== "number") continue;
      const value = DEFAULT_PARAMS[key as keyof typeof DEFAULT_PARAMS] as number;
      expect(value, key).toBeGreaterThanOrEqual(meta.min);
      expect(value, key).toBeLessThanOrEqual(meta.max);
    }
  });
});

describe("editor metadata", () => {
  it("puts every parameter in a group the panel knows about", () => {
    const known = new Set(PARAM_GROUPS.map((group) => group.id));
    for (const [key, meta] of Object.entries(PARAM_META)) {
      expect(known.has(meta.group), `${key} is in unknown group "${meta.group}"`).toBe(true);
    }
  });

  it("leaves no group empty, so the panel never draws an empty fold", () => {
    for (const group of PARAM_GROUPS) {
      const members = Object.values(PARAM_META).filter((meta) => meta.group === group.id);
      expect(members.length, `${group.id} is empty`).toBeGreaterThan(0);
    }
  });

  it("gives every enum option a plain-English label", () => {
    for (const [key, meta] of Object.entries(PARAM_META)) {
      if (meta.kind !== "enum" && meta.kind !== "segment") continue;
      for (const option of meta.options) {
        expect(option.label, `${key}.${option.value} has no label`).toBeTruthy();
      }
    }
  });

  /**
   * A slider that spans zero and is not marked centred gets the wrong picture:
   * a fill from the left end, which reads as "how much" on a dial whose left
   * half means "the other way".
   */
  it("marks every slider that runs through zero as centred", () => {
    for (const [key, meta] of Object.entries(PARAM_META)) {
      if (meta.kind !== "number") continue;
      if (meta.min < 0 && meta.max > 0) {
        expect(meta.centred, `${key} runs through zero but is not centred`).toBe(true);
      }
    }
  });
});
