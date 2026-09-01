// Captures each candidate on the catalogue page, then composes contact sheets.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const OUT = process.argv[2] ?? path.join(ROOT, ".shots");
const URL_ = process.argv[3] ?? "http://localhost:3000/catalogue";

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(URL_, { waitUntil: "networkidle" });

// Every card must have decoded, or the shots catch a half-built frame.
await page.evaluate(async () => {
  const imgs = [...document.querySelectorAll("img")];
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
});
await page.waitForTimeout(900);

const stages = await page.locator("[data-shot]").all();
const shots = [];
for (const [i, stage] of stages.entries()) {
  const slug = await stage.getAttribute("data-shot");
  const title = (await stage.evaluate((el) => el.closest("section").querySelector("h2").innerText))
    .replace(/\s+/g, " ")
    .trim();
  const file = path.join(OUT, `${String(i + 1).padStart(2, "0")}-${slug}.png`);
  await stage.screenshot({ path: file });
  shots.push({ file, title });
  process.stdout.write(`${title}\n`);
}

await browser.close();

// Contact sheets, four to a sheet, so they can be judged side by side.
const PER = 4;
const CELL_W = 660;
const LABEL = 30;
for (let s = 0; s * PER < shots.length; s++) {
  const group = shots.slice(s * PER, s * PER + PER);
  const cells = await Promise.all(
    group.map(async ({ file, title }) => {
      const resized = await sharp(file).resize(CELL_W, null, { fit: "inside" }).toBuffer();
      const { height } = await sharp(resized).metadata();
      const label = Buffer.from(
        `<svg width="${CELL_W}" height="${LABEL}"><rect width="100%" height="100%" fill="#18181b"/>` +
          `<text x="10" y="20" font-family="sans-serif" font-size="15" fill="#fafafa">${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`,
      );
      return sharp({ create: { width: CELL_W, height: height + LABEL, channels: 3, background: "#18181b" } })
        .composite([{ input: label, top: 0, left: 0 }, { input: resized, top: LABEL, left: 0 }])
        .png()
        .toBuffer();
    }),
  );
  const metas = await Promise.all(cells.map((c) => sharp(c).metadata()));
  const rowH = Math.max(...metas.map((m) => m.height));
  const sheet = sharp({
    create: { width: CELL_W * 2 + 12, height: rowH * 2 + 12, channels: 3, background: "#09090b" },
  }).composite(
    cells.map((input, i) => ({ input, top: (i > 1 ? rowH + 12 : 0), left: (i % 2 ? CELL_W + 12 : 0) })),
  );
  await sheet.png().toFile(path.join(OUT, `sheet-${s + 1}.png`));
}
process.stdout.write(`\n${shots.length} captured into ${OUT}\n`);
