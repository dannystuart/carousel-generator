// Which card is actually painted on top at the centre of the frame?
//
// A flat arrangement gives the browser's 3D sort nothing to sort by, so paint
// order falls back to DOM order — which is image order, not distance from the
// focused card. Reading pixels is the only way to know; computed styles agree
// with each other and say nothing about who won.
import { chromium } from "@playwright/test";

const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const slugs = process.argv.slice(2);
if (slugs.length === 0) slugs.push("flat-fan", "diagonal-descent", "coverflow", "peek-stack");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const slug of slugs) {
  await page.goto(`${BASE}/catalogue/${slug}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("img")].map((i) => i.decode?.().catch(() => {})));
  });
  await page.waitForTimeout(500);

  // Card 0 starts focused, and DOM order happens to flatter it. Walk into the
  // middle of the set, where a later sibling is the one overlapping.
  await page.locator(".cg-root").focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const root = document.querySelector(".cg-root");
    const items = [...root.querySelectorAll(".cg-item")];
    const place = (item) => {
      const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, (-?[\d.]+)px\)/.exec(item.style.transform);
      return m ? { x: +m[1], y: +m[2], z: +m[3] } : { x: 1e9, y: 1e9, z: 0 };
    };
    // Jitter nudges the focused card a few pixels off the origin, so "nearest to
    // the origin" identifies it where an exact match would not.
    const places = items.map(place);
    let focused = 0;
    for (let i = 1; i < places.length; i++) {
      if (Math.hypot(places[i].x, places[i].y) < Math.hypot(places[focused].x, places[focused].y)) focused = i;
    }
    // Sample across the focused card, not just its middle: a neighbour overlaps
    // its edge long before it reaches the centre, and the edge is where a wrong
    // paint order actually shows.
    const rect = items[focused].getBoundingClientRect();
    const losses = [];
    for (const fx of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const hit = document.elementFromPoint(rect.left + rect.width * fx, rect.top + rect.height / 2);
      const hitItem = hit?.closest(".cg-item");
      const index = hitItem ? items.indexOf(hitItem) : -1;
      if (index !== focused) losses.push(`${Math.round(fx * 100)}%→${index}`);
    }
    return { focused, losses, zSpread: places.map((p) => p.z) };
  });

  const flat = Math.max(...result.zSpread) - Math.min(...result.zSpread) < 0.5;
  process.stdout.write(
    `${slug.padEnd(20)} focused=${result.focused}  ` +
      `${result.losses.length === 0 ? "OK — nothing paints over it" : `COVERED at ${result.losses.join(", ")}`}` +
      `${flat ? "  (flat — no z to sort by)" : ""}\n`,
  );
}

await browser.close();
