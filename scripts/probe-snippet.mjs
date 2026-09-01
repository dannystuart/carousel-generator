// Pastes the exported block into a bare page and drives it, the way somebody
// who copied it would. jsdom proves the script parses and builds nodes; only a
// real browser proves the 3D survives, the frame clips, and dragging works.
import { chromium } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// The golden block stores the engine as a hash so its diff stays readable, so
// put the real thing back before running it — this probe exists to prove the
// snippet works, and a snippet with a comment where its engine should be does
// not. Read out of the generated module rather than imported, because this is
// plain node and that file is TypeScript.
const generated = readFileSync(path.join(ROOT, "src/engine/dist/engineSource.ts"), "utf8");
const engine = JSON.parse(/export const ENGINE_SOURCE = ("(?:[^"\\]|\\.)*")/s.exec(generated)[1]);
const golden = readFileSync(path.join(ROOT, "src/engine/export/__golden__/coverflow.html"), "utf8")
  .replace(/\/\* the engine, sha256:[0-9a-f]+ [^*]*\*\//, () => engine);

// Real pictures, so the cards have something in them and the shot is worth a
// look. The prepared files carry a descriptive name, so map by position.
const prepared = readdirSync(path.join(ROOT, "public", "img"))
  .filter((name) => name.endsWith(".webp") && !name.includes("@0.5x"))
  .sort();
const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#f4f4f5;font-family:system-ui">
${golden.replace(/\.\/images\/(\d+)\.jpg/g, (_, n) => `http://localhost:3000/img/${prepared[(Number(n) - 1) % prepared.length]}`)}
</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const failures = [];
page.on("pageerror", (error) => failures.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(message.text());
});

await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const state = await page.evaluate(() => {
  const frame = document.getElementById("carousel");
  const root = frame.querySelector(".cg-root");
  const stage = root.querySelector(".cg-stage");
  const items = [...root.querySelectorAll(".cg-item")];
  const focused = items.find((i) => i.dataset.cgFocused === "1");
  return {
    cards: items.length,
    // The one thing that must survive: a flattened subtree would report "flat".
    preserve3d: getComputedStyle(stage).transformStyle,
    rootOverflow: getComputedStyle(root).overflow,
    frameOverflow: getComputedStyle(frame).overflow,
    perspective: getComputedStyle(root).perspective,
    // A coverflow's neighbours are yawed; a collapsed one would be all zeros.
    yawed: items.filter((i) => /rotateY\((?!0deg)/.test(i.style.transform)).length,
    focusedTransform: focused ? focused.style.transform : null,
    styleTag: !!document.getElementById("cg-styles"),
    arrows: root.querySelectorAll(".cg-arrow").length,
  };
});

// And it has to actually move when a person drags it.
const before = await page.evaluate(() => document.querySelector(".cg-item").style.transform);
const box = await page.locator("#carousel").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(box.x + box.width / 2 - i * 30, box.y + box.height / 2, { steps: 2 });
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(900);
const after = await page.evaluate(() => document.querySelector(".cg-item").style.transform);

await page.locator("#carousel").screenshot({ path: path.join(ROOT, ".shots", "editor", "snippet.png") });
await browser.close();

const checks = [
  ["no errors on the page", failures.length === 0, failures.join(" | ")],
  ["fourteen cards built", state.cards === 14, String(state.cards)],
  ["the 3D survived", state.preserve3d === "preserve-3d", state.preserve3d],
  ["the frame clips, the carousel does not", state.frameOverflow === "hidden" && state.rootOverflow === "visible", `frame ${state.frameOverflow}, root ${state.rootOverflow}`],
  ["perspective applied", state.perspective === "1800px", state.perspective],
  ["neighbours are yawed", state.yawed >= 4, `${state.yawed} cards`],
  ["the stylesheet came from the snippet", state.styleTag, ""],
  ["arrows rendered", state.arrows === 2, String(state.arrows)],
  ["dragging moves it", before !== after, ""],
];

let failed = 0;
for (const [name, pass, detail] of checks) {
  if (!pass) failed += 1;
  process.stdout.write(`${pass ? "  ok  " : "FAIL  "}${name}${detail ? `  — ${detail}` : ""}\n`);
}
process.stdout.write(`\n${checks.length - failed}/${checks.length} passed\n`);
process.exitCode = failed ? 1 : 0;
