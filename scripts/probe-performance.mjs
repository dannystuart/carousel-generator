// Frame times under a real, continuous drag.
//
// Headed on purpose: headless Chromium composites differently and reads flat
// while a real GPU chokes, so a pass there proves nothing. This opens a window.
// Pass --headless to run it anyway, and treat the numbers as a lower bound.
//
//   pnpm exec node scripts/probe-performance.mjs [slug ...]
import { chromium } from "@playwright/test";

const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const headless = process.argv.includes("--headless");
const slugs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (slugs.length === 0) {
  slugs.push(
    "coverflow", "dual-orbit", "concave-arc", "diagonal-descent", "depth-tunnel", "fanned-arch",
    "helix", "vortex", "cylinder-marquee", "flat-fan", "peek-stack", "vertical-column",
  );
}

const DRAG_MS = 5000;
const BUDGET = 1000 / 60;

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const rows = [];
for (const slug of slugs) {
  await page.goto(`${BASE}/catalogue/${slug}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("img")].map((i) => i.decode?.().catch(() => {})));
  });
  await page.waitForTimeout(600);

  const box = await page.locator("[data-shot]").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const loop = (t) => {
      window.__frames.push(t - last);
      last = t;
      window.__probe = requestAnimationFrame(loop);
    };
    window.__probe = requestAnimationFrame(loop);
  });

  // A real press and a real sweep: the drag path has to keep moving for the
  // whole window or the loop settles and stops costing anything, which would
  // measure an idle carousel and call it fast.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const started = Date.now();
  let tick = 0;
  while (Date.now() - started < DRAG_MS) {
    tick += 1;
    await page.mouse.move(cx + Math.sin(tick / 6) * 260, cy + Math.cos(tick / 9) * 90, { steps: 2 });
    await page.waitForTimeout(12);
  }
  await page.mouse.up();

  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.__probe);
    return window.__frames.slice(2);
  });

  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  const over = frames.filter((f) => f > BUDGET + 0.5).length;
  rows.push({
    slug,
    frames: frames.length,
    fps: (1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)).toFixed(1),
    p50: at(0.5).toFixed(1),
    p95: at(0.95).toFixed(1),
    max: at(1).toFixed(1),
    over,
    overPct: ((over / frames.length) * 100).toFixed(1),
  });
  process.stdout.write(`${slug} done\n`);
}

await browser.close();

process.stdout.write(`\n${headless ? "HEADLESS — lower bound only" : "headed, real GPU"} · 1440x900 · ${DRAG_MS / 1000}s continuous drag\n\n`);
process.stdout.write("style                 fps    p50    p95    max   frames over 16.7ms\n");
for (const r of rows) {
  process.stdout.write(
    `${r.slug.padEnd(20)} ${r.fps.padStart(5)} ${r.p50.padStart(6)} ${r.p95.padStart(6)} ${r.max.padStart(6)}   ` +
      `${String(r.over).padStart(4)} / ${r.frames} (${r.overPct}%)\n`,
  );
}
