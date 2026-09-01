import { expect, test } from "@playwright/test";

/**
 * Whether a linked card actually goes anywhere.
 *
 * This file exists because the unit tests cannot answer that. The bug it guards
 * against was pointer capture taken on `pointerdown`: capture retargets every
 * later pointer event to the element holding it, and a browser only synthesises
 * a `click` where the press and the release landed on the same element — so the
 * root swallowed every click and the anchor a linked card is made of never saw
 * one. Cards with real web addresses silently went nowhere.
 *
 * Hand-dispatched events establish no real capture, so a jsdom test passes just
 * as happily on the broken version. Only real input shows it. See the pointer
 * capture entry in docs/web-build-gotchas.md, and `taking the pointer` in
 * src/engine/controller.interaction.test.ts for the invariant this proves.
 */

/** The demo cards point at example.com; serve it locally rather than reach out. */
const stubPlaceholder = async (context: import("@playwright/test").BrowserContext) => {
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>placeholder</h1>" }),
  );
};

/** Turn the words on, which is what makes the demo cards links at all. */
const showContent = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: /card content/i }).click();
  await page.getByRole("radio", { name: "Centred", exact: true }).click();
  await page.waitForTimeout(700);
};

test.beforeEach(async ({ page, context }) => {
  await stubPlaceholder(context);
  await page.goto("/");
  await page.waitForSelector(".cg-item[data-cg-focused] .cg-card");
});

/**
 * The default, and the reported bug: a card showing nothing gives no sign it can
 * be clicked, so it must not take you anywhere — and must not be a link in the
 * markup either, or a screen reader is told about a link the carousel refuses to
 * follow.
 */
test("a card showing nothing is not a link at all", async ({ page, context }) => {
  const card = page.locator(".cg-item[data-cg-focused] .cg-card");
  await expect(card).not.toHaveAttribute("href", /./);
  expect(await card.evaluate((el) => el.tagName)).toBe("A");

  // The half of the claim a click cannot make. An anchor with no href is not
  // focusable, so a dormant card is out of the tab order and is not announced as
  // a link — which is the whole reason for taking the href off rather than
  // keeping a live link and swallowing its clicks. Checked by trying to focus it
  // rather than by reading `tabIndex`, which reports 0 here and means nothing.
  expect(await card.evaluate((el) => (el.focus(), document.activeElement === el))).toBe(false);

  let opened = false;
  context.once("page", () => {
    opened = true;
  });
  const before = page.url();
  await card.click();
  await page.waitForTimeout(900);
  expect(opened, "nothing should have opened").toBe(false);
  expect(page.url()).toBe(before);
});

test("the centred card follows its link once its words are showing", async ({ page, context }) => {
  await showContent(page);
  const [opened] = await Promise.all([
    context.waitForEvent("page"),
    page.locator(".cg-item[data-cg-focused] a.cg-card").click(),
  ]);
  await opened.waitForLoadState("domcontentloaded");
  expect(opened.url()).toContain("example.com");

  // A new tab, so the tool is still there behind it — which is the whole reason
  // the demo cards are allowed to carry an address at all.
  expect(page.url()).toMatch(/localhost/);
  await opened.close();
});

test("a tap on an off-centre card brings it in rather than leaving the page", async ({
  page,
  context,
}) => {
  await showContent(page);
  // Which card is centred, by its own picture — every focused card is drawn at
  // the same transform, so the style attribute cannot tell them apart.
  const centred = () =>
    page.locator(".cg-item[data-cg-focused] img").first().getAttribute("alt");
  const before = await centred();

  const offCentre = page.locator(".cg-item:not([data-cg-focused]) a.cg-card").first();
  let opened = false;
  context.once("page", () => {
    opened = true;
  });
  await offCentre.click();
  await page.waitForTimeout(900);

  // Nothing opened, and a different card is now in the middle — the coverflow
  // convention: the first tap brings a card to the centre, and only the card
  // already there follows its link.
  expect(opened).toBe(false);
  expect(await centred()).not.toBe(before);
});

test("a drag that happens to end on the centred card does not follow it", async ({
  page,
  context,
}) => {
  await showContent(page);
  const box = (await page.locator(".cg-item[data-cg-focused] a.cg-card").boundingBox())!;
  let opened = false;
  context.once("page", () => {
    opened = true;
  });

  // Out and back, releasing over the card it started on. On a touch screen every
  // swipe finishes on top of something; that is not a request to leave the page.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (const dx of [-40, -120, -60, 0]) {
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(900);

  expect(opened).toBe(false);
});
