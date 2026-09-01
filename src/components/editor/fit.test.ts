import { describe, it, expect } from "vitest";
import { boxScale, stageScale, weight } from "./fit";

/** The editor at 1440×900 with the drawer open, and the box the twelve are tuned in. */
const frame = { width: 1080, height: 900 };
const box = { width: 1040, height: 640 };
const base = boxScale(frame, box);

describe("fitting the arrangement to the window", () => {
  it("falls back to the nominal box with nothing measured yet", () => {
    expect(stageScale(null, frame, box)).toBeCloseTo(1080 / 1040, 6);
  });

  it("leaves a margin rather than letting a bounded shape touch the edges", () => {
    // Dual orbit's ring, near enough: square, and a little larger than the frame.
    const scale = stageScale({ width: 993, height: 994 }, frame, box);
    expect(scale * 994).toBeCloseTo(900 * 0.94, 6);
    expect(scale).toBeLessThan(base);
  });

  it("is bound by whichever side runs out first", () => {
    const tall = stageScale({ width: 260, height: 1000 }, frame, box);
    expect(tall * 1000).toBeCloseTo(900 * 0.94, 6);
  });

  /**
   * A coverflow is fourteen cards on a line and seventeen hundred pixels of it;
   * a flat fan is three thousand. No framing shows all of a strip and fills a
   * screen with it, and the strip was always meant to run off the edge.
   */
  it("stops shrinking rather than reducing a strip to thumbnails", () => {
    const coverflow = stageScale({ width: 1724, height: 374 }, frame, box);
    const flatFan = stageScale({ width: 3132, height: 278 }, frame, box);
    expect(coverflow).toBeCloseTo(base * 0.8, 6);
    expect(flatFan).toBeCloseTo(base * 0.8, 6);
    // However long the strip, the answer is the same — it crops either way.
    expect(coverflow).toBe(flatFan);
  });

  /**
   * The fit shrinks what does not fit and does nothing else. An arrangement
   * smaller than the window arrives at the size it was tuned at — a peek stack
   * or a hard-fading diagonal is a small composition on purpose, and zooming
   * until its three visible cards fill the screen is a different picture, not a
   * better-framed one.
   */
  it("never magnifies an arrangement past its tuned size", () => {
    expect(stageScale({ width: 379, height: 413 }, frame, box)).toBeCloseTo(base, 6);
    expect(stageScale({ width: 20, height: 20 }, frame, box)).toBeCloseTo(base, 6);
  });

  /**
   * The pictures are a fixed size. On a monitor big enough that even the tuned
   * size goes soft, the absolute ceiling takes over from the tuned-size cap.
   */
  it("will not blow the picture up past the point it goes soft, however big the monitor", () => {
    const huge = { width: 4000, height: 2600 };
    expect(boxScale(huge, box)).toBeGreaterThan(1.8);
    expect(stageScale({ width: 379, height: 413 }, huge, box)).toBe(1.8);
  });

  // The measurement divides the applied scale back out, so feeding the result
  // back in has to land on the same answer or the camera hunts for ever.
  it("settles rather than hunting when its own output is fed back to it", () => {
    for (const extent of [
      { width: 993, height: 994 },
      { width: 1724, height: 374 },
      { width: 626, height: 530 },
    ]) {
      let scale = stageScale(extent, frame, box);
      for (let i = 0; i < 10; i++) {
        const painted = { width: extent.width * scale, height: extent.height * scale };
        scale = stageScale(
          { width: painted.width / scale, height: painted.height / scale },
          frame,
          box,
        );
      }
      expect(scale).toBeCloseTo(stageScale(extent, frame, box), 12);
    }
  });

  /**
   * The floor is there to stop a strip being shrunk into thumbnails, and it must
   * not do anything else. Tied to the window alone it did: on a large monitor
   * the floor rose with the screen and held a ring too large to fit, cutting it
   * off top and bottom again — which is the exact bug the fit was built to fix.
   */
  it("does not hold a ring too large to fit just because the monitor is big", () => {
    const big = { width: 2200, height: 1400 };
    const ring = { width: 993, height: 994 };

    const scale = stageScale(ring, big, box);
    expect(scale * ring.height).toBeCloseTo(1400 * 0.94, 6);
    expect(scale * ring.height).toBeLessThanOrEqual(big.height);
    expect(scale * ring.width).toBeLessThanOrEqual(big.width);

    // And the strip on the same monitor still refuses to shrink away.
    expect(stageScale({ width: 1724, height: 374 }, big, box)).toBeCloseTo(
      boxScale(big, box) * 0.8,
      6,
    );
  });

  it("survives a frame with no size, rather than dividing by it", () => {
    const nothing = { width: 0, height: 0 };
    expect(Number.isFinite(stageScale({ width: 100, height: 100 }, nothing, box))).toBe(true);
  });
});

describe("what counts as part of the picture", () => {
  it("weighs a card by how much of the screen it is worth, not just how solid", () => {
    // Full size and fully opaque is the whole of one card's claim.
    expect(weight(1000, 1000, 1)).toBe(1);
    // A third the size is a ninth the area, and half-faded on top of that.
    expect(weight(1000 / 9, 1000, 0.5)).toBeCloseTo(1 / 18, 6);
  });

  it("has no opinion before anything has been drawn", () => {
    expect(weight(0, 0, 1)).toBe(0);
  });
});
