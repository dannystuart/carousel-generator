import type { CarouselItem } from "../controller";
import { DEFAULT_PARAMS } from "../defaults";
import { ENGINE_GLOBAL, ENGINE_SOURCE } from "../dist/engineSource";
import { CSS_BLOCKS } from "../styles";
import type { CarouselParams } from "../types";

export interface HtmlOptions {
  params: CarouselParams;
  items: CarouselItem[];
  /** The id on the container, in case the page already has one of these. */
  id?: string;
  /** Where this came from, for the header comment. */
  toolUrl?: string;
  /** The box the numbers were tuned in. Below it, the whole thing scales. */
  stage?: { width: number; height: number };
}

/**
 * Where the engine stops and the reader's own settings begin.
 *
 * Two script blocks rather than one, because the engine minifies to eighteen
 * kilobytes of single-line JavaScript and burying the pictures and the dials
 * underneath it would make the one part anybody wants to edit unfindable.
 */
export const SETTINGS_MARKER = "<!-- ▼ Your pictures and settings. This is the part to edit. -->";

const DEFAULT_ID = "carousel";
// The address the tool actually lives at. This one rides out on the first line
// of every block somebody pastes into their own page, so it has to be a page
// that exists — once it is out there, nobody is coming back to fix it. Pinned
// whole in toHtml.test.ts for that reason. The repo is still carousel-generator;
// only the public address is web-carousel-generator.
const DEFAULT_TOOL_URL = "https://vanta.supply/tools/web-carousel-generator";
const DEFAULT_STAGE = { width: 1040, height: 640 };

const quote = (value: string) => JSON.stringify(value);

/** What a parameter looks like in the options object. */
function literal(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => literal(entry)).join(", ")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{ ${Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${key}: ${literal(inner)}`)
      .join(", ")} }`;
  }
  if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
  return JSON.stringify(value);
}

/**
 * One self-contained block: markup, the stylesheet it needs, and the engine with
 * the call that starts it. No build step, no dependencies, no framework.
 *
 * Two things it deliberately does not do.
 *
 * It does not pre-render the cards into the markup. The plan's first-paint rule
 * exists because the preview mounts from a React effect, which genuinely runs
 * after paint; here the script is inline and synchronous, immediately after the
 * container, so there is no gap to flash in. What it buys instead is markup a
 * person can actually read and edit — the pictures are a plain array at the top
 * of the script, which is the thing everyone changes first, rather than fourteen
 * nested divs full of transform matrices.
 *
 * And it never emits our own image URLs. That would hotlink our bandwidth into
 * somebody else's site and break their page the day we move a file.
 */
export function toHtml(options: HtmlOptions): string {
  const { params, items } = options;
  const id = options.id ?? DEFAULT_ID;
  const toolUrl = options.toolUrl ?? DEFAULT_TOOL_URL;
  const stage = options.stage ?? DEFAULT_STAGE;

  const usesContent = items.some((item) => item.title || item.caption || item.cta);
  const usesLinks = items.some((item) => typeof item.href === "string");
  const usesNewTab = items.some((item) => item.newTab);

  // Only the rules these settings actually reach for. A carousel with no dots
  // has no business shipping dot styles into somebody else's page.
  const css = [
    CSS_BLOCKS.base,
    usesContent || params.cardReveal !== "never" ? CSS_BLOCKS.content : "",
    params.arrows ? CSS_BLOCKS.arrows : "",
    params.dots ? CSS_BLOCKS.dots : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  // Only what differs from the engine's own defaults, so the object reads as a
  // description of the style rather than a dump of every dial.
  const changed = (Object.keys(DEFAULT_PARAMS) as (keyof CarouselParams)[])
    .filter((key) => JSON.stringify(params[key]) !== JSON.stringify(DEFAULT_PARAMS[key]))
    .map((key) => `      ${key}: ${literal(params[key])},`)
    .join("\n");

  const cards = items
    .map((item, i) => {
      const fields = [`src: "./images/${i + 1}.jpg"`, `alt: ${quote(item.alt ?? "")}`];
      if (usesLinks) fields.push(`href: ${quote(item.href ?? "")}`);
      if (usesNewTab) fields.push(`newTab: ${item.newTab ? "true" : "false"}`);
      if (usesContent) {
        if (items.some((entry) => entry.title)) fields.push(`title: ${quote(item.title ?? "")}`);
        if (items.some((entry) => entry.caption)) fields.push(`caption: ${quote(item.caption ?? "")}`);
        if (items.some((entry) => entry.cta)) fields.push(`cta: ${quote(item.cta ?? "")}`);
      }
      return `      { ${fields.join(", ")} },`;
    })
    .join("\n");

  // `//`, not `<!-- -->`: these sit inside a script block. Browsers tolerate
  // HTML comments in JavaScript as a legacy quirk, which is not a reason to
  // hand somebody a snippet that leans on one.
  // The link note leads, and names the placeholder. Emitting example.com without
  // saying so is how somebody ships a carousel of links to nowhere.
  const notes = [
    usesLinks && items.some((item) => (item.href ?? "").includes("example.com"))
      ? "  // ▲ These link to example.com — a placeholder. Put your own addresses in `href`."
      : "",
    "  // Swap these for your own images, and write real alt text for each one.",
    usesLinks
      ? "  // A card with a web address becomes a link; leave it empty and it stays a picture."
      : "",
    // Worth stating outright: somebody who sets an address and finds it does
    // nothing will look at their href long before they look at `cardLink`.
    usesLinks && params.cardLink === "content"
      ? "  // Cards only follow their address while their words are showing (cardLink).\n" +
        "  // Set cardLink to \"always\" for pictures that link with no text on them."
      : "",
    usesNewTab ? "  // `newTab: true` opens it in a new tab, leaving your page where it is." : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `<!-- 3D carousel · built with ${toolUrl} -->
<!-- This div is the frame. The carousel is built inside it, and the clipping
     lives here rather than on the carousel: overflow on the carousel's own
     element flattens the 3D and the whole arrangement collapses flat. -->
<div id="${id}" style="position: relative; width: 100%; max-width: ${stage.width}px; margin: 0 auto; aspect-ratio: ${stage.width} / ${stage.height}; overflow: hidden;"></div>

<style id="cg-styles">
${css}
</style>

<!-- The engine. Nothing to configure in here — fold it up and ignore it. -->
<script>${ENGINE_SOURCE}</script>

${SETTINGS_MARKER}
<script>
(function () {
${notes}
  var items = [
${cards}
  ];

  // The numbers below are in pixels, set against a ${stage.width}px-wide stage.
  // So the carousel is built at that size inside the frame and the whole thing
  // is scaled to fit — on a phone the arrangement stays the arrangement instead
  // of one card filling the screen. Dragging still measures correctly, because
  // the engine compares its painted width against its layout width on a press.
  var frame = document.getElementById(${quote(id)});
  var root = document.createElement("div");
  root.style.cssText = "position:absolute;top:0;left:0;transform-origin:top left;width:${stage.width}px;height:${stage.height}px";
  frame.appendChild(root);

  ${ENGINE_GLOBAL}.createCarousel(root, {
    items: items,
    params: {
${changed}
    }
  });

  function fit() {
    root.style.transform = "scale(" + Math.min(1, frame.clientWidth / ${stage.width}) + ")";
  }
  fit();
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(frame);
  else window.addEventListener("resize", fit);
})();
</script>
`;
}
