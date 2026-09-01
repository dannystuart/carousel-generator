import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no pointer capture, and the slider's number-scrub asks for one.
 *
 * A no-op is the honest stand-in rather than a fake: capture changes *where*
 * events are delivered, not what they mean, and a test fires them straight at
 * the element regardless. What this cannot cover is a pointer leaving the
 * number mid-drag — that needs a real browser, and it is on the list in
 * docs/plans/2026-08-11-editor-ui-rework.md.
 */
const proto = Element.prototype as unknown as Record<string, unknown>;
if (typeof proto.setPointerCapture !== "function") {
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.hasPointerCapture = () => false;
}
