import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { PRESETS } from "../src/engine/presets";

/**
 * One picture per style, committed. The unit tests say the numbers are right;
 * this is the only thing that notices when a change to the geometry quietly
 * ruins style number seven while every number it asserts stays true.
 *
 * `?static=1` parks the two styles that turn on their own, so a baseline is a
 * fixed arrangement rather than a photograph of a moment.
 *
 * Only one size per style, deliberately. The style page draws each one in the
 * fixed 1040×640 box the twelve were tuned in, so a narrow viewport produces the
 * identical picture — twelve more files and nothing more caught. The size that
 * does change things is the editor's, where the whole stage scales to fit, so
 * that gets its own two shots at the bottom.
 */
async function ready(page: Page) {
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("img")].map((img) => img.decode?.().catch(() => {})));
  });
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.waitForTimeout(600);
}

for (const preset of PRESETS) {
  test(`style — ${preset.slug}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/catalogue/${preset.slug}?static=1`, { waitUntil: "networkidle" });
    await ready(page);
    await expect(page.locator("[data-shot]")).toHaveScreenshot(`${preset.slug}.png`);
  });
}

for (const size of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 375, height: 667 },
] as const) {
  test(`editor — ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await ready(page);
    // The entrance animation fills its end state, so this is stable once it has
    // run; the opening style does not drift.
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`editor-${size.name}.png`, { fullPage: size.name === "phone" });
  });
}
