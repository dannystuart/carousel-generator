import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/catalogue", { waitUntil: "networkidle" });

const column = page.locator("[data-shot='vertical-column'] .cg-root");
await column.scrollIntoViewIfNeeded();

// Watch what the handlers actually see.
await column.evaluate((el) => {
  window.__log = [];
  for (const type of ["pointerdown", "pointermove", "pointerup"]) {
    el.addEventListener(
      type,
      (e) => window.__log.push({ type, x: Math.round(e.clientX), y: Math.round(e.clientY) }),
      true,
    );
  }
});

const shape = () =>
  column.evaluate((el) => {
    const items = [...el.querySelectorAll(".cg-item")];
    return {
      rendered: items.filter((i) => i.style.display !== "none").length,
      focused: items.findIndex((i) => /translate3d\(0px, 0px, 0px\)/.test(i.style.transform)),
      dragging: el.getAttribute("data-cg-dragging"),
      touch: getComputedStyle(el).touchAction,
    };
  });

const box = await column.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
console.log("box", JSON.stringify(box));
console.log("before", JSON.stringify(await shape()));

await page.mouse.move(cx, cy);
await page.mouse.down();
console.log("after down", JSON.stringify(await shape()));
await page.mouse.move(cx, cy - 60, { steps: 6 });
console.log("mid drag", JSON.stringify(await shape()));
await page.mouse.move(cx, cy - 180, { steps: 12 });
console.log("end drag", JSON.stringify(await shape()));
await page.mouse.up();
await page.waitForTimeout(2000);
console.log("settled", JSON.stringify(await shape()));
console.log("events", JSON.stringify(await page.evaluate(() => window.__log.slice(0, 4))));

await browser.close();
