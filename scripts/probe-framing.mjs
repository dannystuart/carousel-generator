// Where does each style actually land in its box?
//
// The engine centres an arrangement by measuring the shape it computes, before
// the browser's perspective divide and before the cards have any size. Both of
// those move the picture, so the only honest measurement is the union of what
// is painted. Reports the offset of that union's centre from the middle of the
// stage, and how far it spills past each edge.
import { chromium } from "@playwright/test";

const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  slugs.push(
    "coverflow", "dual-orbit", "concave-arc", "diagonal-descent", "depth-tunnel", "fanned-arch",
    "helix", "vortex", "cylinder-marquee", "flat-fan", "peek-stack", "vertical-column",
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

process.stdout.write("style                 offset x/y      spill L/R/T/B\n");
for (const slug of slugs) {
  await page.goto(`${BASE}/catalogue/${slug}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("img")].map((i) => i.decode?.().catch(() => {})));
  });
  await page.waitForTimeout(600);

  const m = await page.evaluate(() => {
    const stage = document.querySelector("[data-shot]");
    const box = stage.getBoundingClientRect();
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const item of stage.querySelectorAll(".cg-item")) {
      // A card faded to nothing is not part of the picture.
      const card = item.querySelector(".cg-card");
      if (Number(card?.style.opacity || 1) < 0.05) continue;
      const r = item.getBoundingClientRect();
      if (r.width === 0) continue;
      left = Math.min(left, r.left); right = Math.max(right, r.right);
      top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
    }
    return {
      dx: Math.round((left + right) / 2 - (box.left + box.right) / 2),
      dy: Math.round((top + bottom) / 2 - (box.top + box.bottom) / 2),
      spill: [
        Math.round(Math.max(0, box.left - left)),
        Math.round(Math.max(0, right - box.right)),
        Math.round(Math.max(0, box.top - top)),
        Math.round(Math.max(0, bottom - box.bottom)),
      ],
    };
  });

  const flag = Math.abs(m.dy) > 30 || Math.abs(m.dx) > 30 ? "  <-- off centre" : "";
  process.stdout.write(
    `${slug.padEnd(20)} ${String(m.dx).padStart(5)} ${String(m.dy).padStart(5)}      ` +
      `${m.spill.map((s) => String(s).padStart(4)).join(" ")}${flag}\n`,
  );
}

await browser.close();
