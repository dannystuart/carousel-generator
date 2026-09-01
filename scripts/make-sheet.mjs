// Composes named shots into one labelled contact sheet, for judging a handful
// of styles side by side without re-reading the whole catalogue.
import sharp from "sharp";
import path from "node:path";

const [out, ...files] = process.argv.slice(2);
const CELL = 640;
const LABEL = 28;

const cells = await Promise.all(
  files.map(async (file) => {
    const resized = await sharp(file).resize(CELL, null, { fit: "inside" }).toBuffer();
    const { height } = await sharp(resized).metadata();
    const name = path.basename(file, ".png").replace(/^\d+-/, "").replace(/-/g, " ");
    const label = Buffer.from(
      `<svg width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#18181b"/>` +
        `<text x="10" y="19" font-family="sans-serif" font-size="14" fill="#fafafa">${name}</text></svg>`,
    );
    return sharp({ create: { width: CELL, height: height + LABEL, channels: 3, background: "#18181b" } })
      .composite([
        { input: label, top: 0, left: 0 },
        { input: resized, top: LABEL, left: 0 },
      ])
      .png()
      .toBuffer();
  }),
);

const metas = await Promise.all(cells.map((c) => sharp(c).metadata()));
const rowH = Math.max(...metas.map((m) => m.height));
const cols = Math.min(2, cells.length);
const rows = Math.ceil(cells.length / cols);

await sharp({
  create: {
    width: CELL * cols + 8 * (cols - 1),
    height: rowH * rows + 8 * (rows - 1),
    channels: 3,
    background: "#09090b",
  },
})
  .composite(
    cells.map((input, i) => ({
      input,
      top: Math.floor(i / cols) * (rowH + 8),
      left: (i % cols) * (CELL + 8),
    })),
  )
  .png()
  .toFile(out);

console.log(`wrote ${out}`);
