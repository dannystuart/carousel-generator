// Captures each of the twelve styles alone at full size, and stacks each one
// over its reference image so the two can be judged against each other rather
// than from memory. Needs `pnpm dev` running.
//
//   pnpm shoot:styles              every style
//   pnpm shoot:styles coverflow    just that one
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".shots", "full");
const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const REFS = path.join(ROOT, "Carousel Inspiration");

/** Which reference each style is aiming at. Some were built from nothing. */
const REFERENCE = {
  coverflow: null,
  "dual-orbit": "apple_watch_watch_face_dual_orbit.png",
  "concave-arc": "_ (40).jpeg",
  "diagonal-descent": "screenshot_iphone_16_pro_features_display.png",
  "depth-tunnel": "floating_photo_cards_interface.png",
  "fanned-arch": "Pin by 航天",
  helix: null,
  vortex: "music_album_art_push_oh_sattel.png",
  "cylinder-marquee": "CLOU Architects.jpeg",
  "flat-fan": "_ (41).jpeg",
  "peek-stack": null,
  "vertical-column": null,
};

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const slugs = Object.keys(REFERENCE).filter((s) => only.length === 0 || only.includes(s));

const available = await readdir(REFS).catch(() => []);
const findRef = (hint) => {
  if (!hint) return null;
  const match = available.find((f) => f.startsWith(hint) || f === hint);
  return match ? path.join(REFS, match) : null;
};

// Only a full run clears the folder. Re-shooting one style after a tweak must
// not throw away the eleven it is being compared against.
if (only.length === 0) await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const shots = [];
for (const [i, slug] of slugs.entries()) {
  await page.goto(`${BASE}/catalogue/${slug}`, { waitUntil: "networkidle" });
  // Every card must have decoded, or the shot catches a half-built frame.
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img")];
    await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));
  });
  await page.waitForTimeout(700);

  const stage = page.locator("[data-shot]");
  const file = path.join(OUT, `${String(i + 1).padStart(2, "0")}-${slug}.png`);
  await stage.screenshot({ path: file });
  shots.push({ slug, file });
  process.stdout.write(`${slug}\n`);
}
await browser.close();

// One comparison image per style: ours on top, its reference below.
const WIDTH = 1040;
const LABEL = 26;
const labelStrip = (text, tint) =>
  Buffer.from(
    `<svg width="${WIDTH}" height="${LABEL}"><rect width="100%" height="100%" fill="#18181b"/>` +
      `<text x="10" y="18" font-family="sans-serif" font-size="14" fill="${tint}">${text}</text></svg>`,
  );

const band = async (input, text, tint) => {
  const resized = await sharp(input).resize(WIDTH, null, { fit: "inside" }).toBuffer();
  const { height } = await sharp(resized).metadata();
  return sharp({ create: { width: WIDTH, height: height + LABEL, channels: 3, background: "#18181b" } })
    .composite([
      { input: labelStrip(text, tint), top: 0, left: 0 },
      { input: resized, top: LABEL, left: 0 },
    ])
    .png()
    .toBuffer();
};

for (const { slug, file } of shots) {
  const refPath = findRef(REFERENCE[slug]);
  const bands = [await band(file, `${slug} — ours, ${WIDTH}px wide`, "#a5f3d0")];
  if (refPath) bands.push(await band(refPath, `${slug} — reference: ${path.basename(refPath)}`, "#fcd34d"));
  if (bands.length === 1) continue;

  const metas = await Promise.all(bands.map((b) => sharp(b).metadata()));
  const total = metas.reduce((sum, m) => sum + m.height, 0) + (bands.length - 1) * 8;
  let top = 0;
  const layers = bands.map((input, i) => {
    const layer = { input, top, left: 0 };
    top += metas[i].height + 8;
    return layer;
  });
  await sharp({ create: { width: WIDTH, height: total, channels: 3, background: "#09090b" } })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, `compare-${slug}.png`));
}

// And a contact sheet of all twelve, two up.
if (shots.length > 1) {
  const CELL = 640;
  const cells = await Promise.all(
    shots.map(async ({ slug, file }) => {
      const resized = await sharp(file).resize(CELL, null, { fit: "inside" }).toBuffer();
      const { height } = await sharp(resized).metadata();
      const label = Buffer.from(
        `<svg width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#18181b"/>` +
          `<text x="8" y="18" font-family="sans-serif" font-size="14" fill="#fafafa">${slug}</text></svg>`,
      );
      return sharp({ create: { width: CELL, height: height + LABEL, channels: 3, background: "#18181b" } })
        .composite([{ input: label, top: 0, left: 0 }, { input: resized, top: LABEL, left: 0 }])
        .png()
        .toBuffer();
    }),
  );
  const metas = await Promise.all(cells.map((c) => sharp(c).metadata()));
  const rowH = Math.max(...metas.map((m) => m.height));
  const rows = Math.ceil(cells.length / 2);
  await sharp({
    create: { width: CELL * 2 + 10, height: rowH * rows + (rows - 1) * 10, channels: 3, background: "#09090b" },
  })
    .composite(
      cells.map((input, i) => ({
        input,
        top: Math.floor(i / 2) * (rowH + 10),
        left: (i % 2) * (CELL + 10),
      })),
    )
    .png()
    .toFile(path.join(OUT, "sheet.png"));
}

process.stdout.write(`\n${shots.length} captured into ${OUT}\n`);
