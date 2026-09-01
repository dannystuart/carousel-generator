// The editor's own checks: does picking a style move the sliders, does moving a
// slider move the picture, and does the phone layout hold up.
//
// Playwright rather than the in-app pane, which rescales its viewport between
// calls and paints progressively — a screenshot there is not evidence.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SHOOT_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "..", ".shots", "editor");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

const settle = async (ms = 700) => page.waitForTimeout(ms);
const decode = () =>
  page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("img")].map((i) => i.decode?.().catch(() => {})));
  });

await page.goto(BASE, { waitUntil: "networkidle" });
await decode();
await settle(900);
await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());

// --- the preview is the size the presets were tuned against ----------------
const stage = await page.locator("main .grid > div").first().boundingBox();
check(
  "preview is 1040x640 at 1440x900",
  Math.abs(stage.width - 1042) < 3 && Math.abs(stage.height - 642) < 3,
  `${Math.round(stage.width)}x${Math.round(stage.height)} (incl. 1px border each side)`,
);

await page.screenshot({ path: path.join(OUT, "desktop-coverflow.png") });

// --- picking a style walks the sliders across -------------------------------
const readCurve = () => page.locator("#cg-curve").inputValue();
const before = await readCurve();
await page.getByRole("button", { name: "Fanned arch", exact: true }).click();
await page.waitForTimeout(90);
const during = await readCurve();
await settle(900);
const after = await readCurve();

check(
  "picking a style animates the sliders rather than snapping",
  Number(during) !== Number(before) && Number(during) !== Number(after),
  `curve ${before} → ${during} mid-move → ${after}`,
);
check("…and lands exactly on the style's value", Number(after) === 0.52, `curve ${after}`);
await decode();
await settle(600);
await page.screenshot({ path: path.join(OUT, "desktop-fanned-arch.png") });

// --- an inert control greys itself out and says why -------------------------
await page.getByRole("button", { name: "Flat fan", exact: true }).click();
await settle(900);
const depth = await page.evaluate(() => {
  const input = document.querySelector("#cg-depth");
  const row = input.closest("div");
  return { disabled: input.disabled, note: row.querySelector("p")?.textContent ?? "" };
});
check(
  "Depth greys out on a flat style and explains itself",
  depth.disabled && /curve/i.test(depth.note),
  depth.note,
);
await decode();
await settle(500);
await page.screenshot({ path: path.join(OUT, "desktop-flat-fan-inert.png") });

// --- moving a slider moves the picture --------------------------------------
await page.getByRole("button", { name: "Coverflow", exact: true }).click();
await settle(900);
const firstCard = () =>
  page.evaluate(() => document.querySelectorAll(".cg-item")[1]?.style.transform ?? "");
const cardBefore = await firstCard();
await page.locator("#cg-spacing").focus();
for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
await settle(700);
const cardAfter = await firstCard();
check("a slider moves the carousel without remounting it", cardBefore !== cardAfter);
// Scoped to the panel: the copied stylesheet carries a comment inviting people
// to edit it, which a page-wide text search happily counts as a match.
check(
  "…and editing marks the style as edited rather than pretending it is untouched",
  (await page.locator('aside >> text="edited"').count()) === 1,
);

// --- the phone ---------------------------------------------------------------
await page.setViewportSize({ width: 375, height: 667 });
await settle(700);
await decode();
await settle(500);

const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
check(
  "no sideways scroll at 375px",
  overflow.scrollWidth <= overflow.clientWidth + 1,
  `${overflow.scrollWidth} vs ${overflow.clientWidth}`,
);

const panel = await page.evaluate(() => {
  const slider = document.querySelector("#cg-curve");
  const aside = document.querySelector("aside");
  return {
    panelVisible: aside ? aside.getBoundingClientRect().height > 100 : false,
    slidersOff: slider ? slider.disabled : null,
    note: aside?.querySelector("p")?.textContent ?? "",
  };
});
check("the panel is shown on a phone, not hidden", panel.panelVisible);
check("…but the sliders are inert, with a note saying why", panel.slidersOff === true, panel.note.slice(0, 60));

const taps = await page.evaluate(() =>
  // Two exclusions, both deliberate. A disabled control is not a tap target —
  // on a phone the whole slider panel is inert by design. And the carousel's
  // own arrows live inside a preview that is scaled to fit, so they shrink with
  // the picture: at full size on somebody's site they are the 44px the engine
  // draws. Swipe is the phone gesture; the arrows there show what the style
  // includes. Everything the *editor* asks a thumb to hit is measured.
  [...document.querySelectorAll("main button:not(:disabled)")]
    .filter((b) => !b.closest(".cg-root"))
    .map((b) => {
      const r = b.getBoundingClientRect();
      return { label: (b.textContent || b.getAttribute("aria-label") || "?").slice(0, 22), h: Math.round(r.height), w: Math.round(r.width) };
    })
    .filter((b) => b.h > 0 && b.h < 44),
);
check(
  "every tap target on a phone is at least 44px tall",
  taps.length === 0,
  taps.length ? taps.map((t) => `${t.label} ${t.w}x${t.h}`).join(", ") : "",
);

await page.screenshot({ path: path.join(OUT, "phone.png"), fullPage: true });
await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  process.stdout.write(`${r.pass ? "  ok  " : "FAIL  "}${r.name}${r.detail ? `  — ${r.detail}` : ""}\n`);
}
process.stdout.write(`\n${results.length - failed}/${results.length} passed · shots in ${OUT}\n`);
process.exitCode = failed ? 1 : 0;
