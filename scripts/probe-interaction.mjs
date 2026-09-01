// Real mouse input against the running dev server, for the things synthetic
// events cannot reach: pointer capture, and click generation.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/catalogue", { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await Promise.all([...document.querySelectorAll("img")].map((i) => i.decode?.().catch(() => {})));
});

const results = {};

// --- arrows -------------------------------------------------------------
const coverflow = page.locator("[data-shot='coverflow'] .cg-root");
await coverflow.scrollIntoViewIfNeeded();
const read = (root) =>
  root.evaluate((el) => {
    const items = [...el.querySelectorAll(".cg-item")];
    // Which card is sitting at the origin. Robust to culling, unlike reading one
    // node's transform — a hidden card keeps whatever it had when it left view.
    return items.findIndex((i) => /translate3d\(0px, 0px, 0px\)/.test(i.style.transform));
  });

let before = await read(coverflow);
await coverflow.locator(".cg-arrow--next").click();
await page.waitForTimeout(800);
results.nextArrowMoves = before !== (await read(coverflow));

before = await read(coverflow);
await coverflow.locator(".cg-arrow--prev").click();
await page.waitForTimeout(800);
results.prevArrowMoves = before !== (await read(coverflow));

// --- tapping a card ----------------------------------------------------
const focusedScale = (root) =>
  root.evaluate((el) => {
    const items = [...el.querySelectorAll(".cg-item")];
    // The focused card is the one sitting at the origin.
    const at = items.findIndex((i) => /translate3d\(0px, 0px, 0px\)/.test(i.style.transform));
    return at;
  });

const wide = page.locator("[data-shot='coverflow'] .cg-root");
await wide.scrollIntoViewIfNeeded();
results.focusedBeforeTap = await focusedScale(wide);
// A card two to the right of centre.
const target = wide.locator(".cg-item").nth(2);
await target.click({ position: { x: 20, y: 20 } });
await page.waitForTimeout(900);
results.focusedAfterTap = await focusedScale(wide);

// --- a drag must not be read as a tap ----------------------------------
await wide.scrollIntoViewIfNeeded();
const box = await wide.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(2600); // a long fling can run to 1600ms
results.focusedAfterDrag = await focusedScale(wide);

// --- the vertical track --------------------------------------------------
const column = page.locator("[data-shot='vertical-column'] .cg-root");
await column.scrollIntoViewIfNeeded();
const colBox = await column.boundingBox();
const cx = colBox.x + colBox.width / 2;
const cy = colBox.y + colBox.height / 2;

let colBefore = await read(column);
// Drag upward: should pull later cards up into view.
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx, cy - 180, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1800);
results.verticalDragMoves = colBefore !== (await read(column));

// A sideways drag across a vertical track must do nothing.
colBefore = await read(column);
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 200, cy, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(1800);
results.sidewaysDragIgnoredOnColumn = colBefore === (await read(column));

results.columnTouchAction = await column.evaluate((el) => getComputedStyle(el).touchAction);
results.coverflowTouchAction = await coverflow.evaluate((el) => getComputedStyle(el).touchAction);

console.log(JSON.stringify(results, null, 1));
await browser.close();
