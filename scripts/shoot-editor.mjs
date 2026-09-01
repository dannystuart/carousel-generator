// Every style as the editor now draws it, on one sheet — so the question
// "does revealing the overhang spoil any of them?" can be answered by looking
// rather than by remembering.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] ?? "/tmp/editor-shots";
const DRAWER = process.argv[3] !== "closed";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
await page.evaluate((open) => {
  window.localStorage.setItem("cg.drawer", open ? "open" : "closed");
}, DRAWER);
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());

const names = await page.$$eval("[aria-pressed][title]", (els) => els.map((e) => e.textContent.trim()));

const files = [];
for (const [i, name] of names.entries()) {
  await page.click(`[aria-pressed][title]:has-text("${name}")`);
  await page.waitForTimeout(1100);
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("img")].map((i) => i.decode?.().catch(() => {})));
  });
  const file = path.join(OUT, `${String(i).padStart(2, "0")}-${name.toLowerCase().replace(/\s+/g, "-")}.png`);
  await page.screenshot({ path: file });
  files.push({ file, name });
}

await browser.close();

// Four across, labelled, so twelve fit in one glance.
const CELL = { w: 480, h: 300 };
const cells = await Promise.all(
  files.map(async ({ file, name }) => {
    const img = await sharp(file).resize(CELL.w, CELL.h, { fit: "fill" }).toBuffer();
    const label = Buffer.from(
      `<svg width="${CELL.w}" height="26"><rect width="100%" height="100%" fill="#000"/><text x="8" y="18" font-family="monospace" font-size="13" fill="#eee">${name}</text></svg>`,
    );
    return sharp({ create: { width: CELL.w, height: CELL.h + 26, channels: 3, background: "#000" } })
      .composite([{ input: label, top: 0, left: 0 }, { input: img, top: 26, left: 0 }])
      .png()
      .toBuffer();
  }),
);

const COLS = 4;
const rows = Math.ceil(cells.length / COLS);
const sheet = path.join(OUT, "sheet.png");
await sharp({
  create: { width: CELL.w * COLS, height: (CELL.h + 26) * rows, channels: 3, background: "#111" },
})
  .composite(
    cells.map((input, i) => ({
      input,
      left: (i % COLS) * CELL.w,
      top: Math.floor(i / COLS) * (CELL.h + 26),
    })),
  )
  .png()
  .toFile(sheet);

console.log(sheet);
