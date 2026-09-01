import { DEFAULT_PARAMS } from "./defaults";
import { cardVisual } from "./geometry";
import { arrangementCentre, cardsPerRow, visibleRange, wrappedOffset } from "./layout";
import { createAnimator } from "./motion";
import { ensureStyles } from "./styles";
import type { CarouselParams, RingSpec } from "./types";

export interface CarouselItem {
  src: string;
  alt: string;
  srcSmall?: string;
  width?: number;
  height?: number;
  /** Where the card goes when it is tapped. Empty or absent leaves it a picture. */
  href?: string;
  /** Opens `href` in a new tab, leaving the page the carousel is on where it is. */
  newTab?: boolean;
  /** Shown over the picture when `cardReveal` says so. */
  title?: string;
  caption?: string;
  /** The button's words — "View project", "Read more". */
  cta?: string;
}

export interface CarouselOptions {
  items: CarouselItem[];
  params?: Partial<CarouselParams>;
  /**
   * The position to open on, in card units — fractional is welcome. For a
   * carousel being rebuilt in place — the editor does this whenever a style
   * change alters the card count — it is the old instance's `phase()`, so the
   * rebuild takes over mid-turn instead of snapping the visitor back to the
   * first card. A snapping carousel handed a fractional start settles to the
   * nearest card on its own.
   */
  startAt?: number;
}

export interface CarouselInstance {
  next(): void;
  prev(): void;
  goTo(index: number): void;
  setParams(partial: Partial<CarouselParams>): void;
  params(): Readonly<CarouselParams>;
  /** The card currently in focus. */
  index(): number;
  /** Position in card units — fractional mid-drag. */
  position(): number;
  /**
   * Where the base ring visually stands, in card units: the position plus
   * however far its own drift has carried it, wrapped to the card range.
   *
   * `position()` alone cannot answer this for a drifting style — a cylinder
   * marquee that has been turning for ten seconds is four and a half cards
   * past its position, and a rebuild seeded from the position snapped the
   * whole ring back by exactly that much. Hand this to `startAt` instead and
   * the rebuilt carousel takes over from the very angle the old one showed.
   */
  phase(): number;
  destroy(): void;
}

/** One rendered card: a node triple plus which ring and item it belongs to. */
interface Slot {
  item: HTMLDivElement;
  /** A div, or an anchor where the item carries a web address. */
  card: HTMLElement;
  /** The item's address, kept here so `cardLink` can take the href off and put it back. */
  href: string;
  img: HTMLImageElement;
  ring: number;
  index: number;
  hidden: boolean;
  /** Nearest the centre. Drives the reveal, and whether a tap follows the link. */
  focused: boolean;
  /** Last written paint order, so an unchanged one is not written again. */
  zIndex: number;
}

const SINGLE_RING: RingSpec = { scale: 1, drift: 0 };

/** Guards against a second carousel on the same element. */
const occupied = new WeakSet<HTMLElement>();

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Dots stop being useful long before this; longer sets get a note in the export. */
const MAX_DOTS = 12;

/** Velocity is read over this window, so a finger that stopped is not a flick. */
const VELOCITY_WINDOW_MS = 120;

/** Move further than this between press and release and it was a drag, not a tap. */
const TAP_SLOP_PX = 8;

/**
 * How a drifting ring gives way to somebody steering it, and how it takes over
 * again afterwards.
 *
 * A ring that never stops turning makes "bring this card to the middle" true
 * for about a second: at half a card a second the card you picked has slid off
 * centre before you have looked at it. So a deliberate move — a tap, an arrow,
 * a dot, a drag — winds the drift down, leaves the carousel still long enough
 * to read, and then winds it back up.
 *
 * The stop is quicker than the start because those two are not the same event.
 * Stopping is the carousel answering you and wants to feel immediate; starting
 * again is it resuming something of its own, and creeping back in is how it
 * avoids looking like a second thing you did.
 */
const DRIFT_SPIN_DOWN_MS = 450;
const DRIFT_SPIN_UP_MS = 1200;
/** Stillness after the ring has fully stopped, before it starts creeping back. */
const DRIFT_HOLD_MS = 3000;

const WHEEL_THRESHOLD = 24;
const WHEEL_COOLDOWN_MS = 320;

/**
 * The card the content panel's type was drawn against — the engine's own default
 * width and shape. Everything in `.cg-content` is sized against how the current
 * card compares to this. Read by `contentFit`.
 */
const TUNED_CARD = {
  width: DEFAULT_PARAMS.cardWidth,
  height: DEFAULT_PARAMS.cardWidth * DEFAULT_PARAMS.cardAspect,
};

export function createCarousel(root: HTMLElement, options: CarouselOptions): CarouselInstance {
  if (occupied.has(root)) {
    throw new Error("createCarousel: that element already has a carousel on it — call destroy() first.");
  }
  occupied.add(root);

  const doc = root.ownerDocument;
  const view = doc.defaultView;
  ensureStyles(doc);

  const items = options.items;
  const count = items.length;
  let params: CarouselParams = { ...DEFAULT_PARAMS, ...options.params };
  let destroyed = false;

  // --- reduced motion ----------------------------------------------------
  //
  // Per the spec, the *arrangement* is untouched: ring, angles, depth and pitch
  // are exactly as designed. Only the travel between cards changes — it stops
  // being a sweep and becomes a crossfade — and nothing moves on its own.
  // So geometry always reads `params`; only the animator reads `motionParams`.

  let reduced = false;
  let motionQuery: MediaQueryList | null = null;
  let motionParams: CarouselParams = params;

  function refreshMotionParams() {
    motionParams = reduced ? { ...params, speed: 0 } : params;
  }

  if (view && typeof view.matchMedia === "function") {
    try {
      motionQuery = view.matchMedia("(prefers-reduced-motion: reduce)");
      reduced = motionQuery.matches === true;
    } catch {
      motionQuery = null;
    }
  }
  refreshMotionParams();

  // Wrapped (or clamped, without a loop) to a card that exists — the rebuild
  // that hands this in may be moving to a style with fewer cards than the one
  // the visitor was on. Deliberately not rounded: a drifting ring's phase is
  // between cards by nature, and rounding it here is a half-card lurch.
  const cardsAtStart = cardsPerRow(params, count);
  const wished = Number.isFinite(options.startAt ?? 0) ? (options.startAt ?? 0) : 0;
  const startAt = params.loop
    ? ((wished % cardsAtStart) + cardsAtStart) % cardsAtStart
    : Math.max(0, Math.min(cardsAtStart - 1, wished));
  const animator = createAnimator(() => motionParams, startAt);

  // --- DOM ---------------------------------------------------------------

  root.classList.add("cg-root");

  const stage = doc.createElement("div");
  stage.className = "cg-stage";
  stage.style.transformStyle = "preserve-3d";

  let slots: Slot[] = [];
  let builtRings = 0;

  /**
   * One full set of cards per ring — a second ring is another complete carousel
   * at a different radius, not a redistribution of the first. Rebuilt only when
   * the *number* of rings changes; every other parameter is a restyle.
   */
  function buildSlots(ringCount: number) {
    for (const slot of slots) slot.item.remove();
    slots = [];
    builtRings = ringCount;

    for (let ring = 0; ring < ringCount; ring++) {
      for (let index = 0; index < count; index++) {
        const source = items[index];
        const item = doc.createElement("div");
        item.className = "cg-item";

        // An anchor where the card goes somewhere, a plain div where it does
        // not — rather than an anchor with a placeholder href on every card,
        // which is a link to nowhere for every screen reader and every crawler.
        //
        // Whether it *currently* carries an href is a separate question, and the
        // one `cardLink` answers — see `applyLinks`. An anchor with no href is
        // not a link: not focusable, not announced as one, nothing to follow. So
        // the element is settled once here and the link comes and goes on it,
        // rather than the card being rebuilt every time a setting moves.
        const linked = typeof source.href === "string" && source.href.length > 0;
        const card = doc.createElement(linked ? "a" : "div");
        card.className = "cg-card";
        if (linked) {
          card.draggable = false;
          // `noopener` is the load-bearing half — without it the page we open
          // can reach back through `window.opener` and navigate ours. `referrer`
          // is politeness. Both, because this markup lands on other people's
          // sites and they should not have to know to add them.
          if (source.newTab) {
            (card as HTMLAnchorElement).target = "_blank";
            (card as HTMLAnchorElement).rel = "noopener noreferrer";
          }
        }

        const img = doc.createElement("img");
        img.src = source.src;
        img.alt = source.alt;
        img.decoding = "async";
        img.draggable = false;
        if (source.width) img.width = source.width;
        if (source.height) img.height = source.height;

        card.appendChild(img);

        // Written once at mount and left alone. `cardReveal` only decides
        // whether it is *shown*, because this is a screen reader's only route to
        // what a card is and rebuilding it away would take that route with it.
        if (source.title || source.caption || source.cta) {
          const content = doc.createElement("div");
          content.className = "cg-content";
          for (const [text, tag, className] of [
            [source.title, "h3", "cg-title"],
            [source.caption, "p", "cg-caption"],
            [source.cta, "span", "cg-cta"],
          ] as const) {
            if (!text) continue;
            const node = doc.createElement(tag);
            node.className = className;
            node.textContent = text;
            content.appendChild(node);
          }
          card.appendChild(content);
        }

        item.appendChild(card);
        stage.appendChild(item);
        slots.push({
          item,
          card,
          href: linked ? (source.href as string) : "",
          img,
          ring,
          index,
          hidden: false,
          focused: false,
          zIndex: NaN,
        });
      }
    }
  }

  buildSlots(Math.max(1, params.rings.length));
  root.appendChild(stage);

  // --- render ------------------------------------------------------------

  const perRow = () => cardsPerRow(params, count);

  function applySceneStyles() {
    // A true zoom rather than a dolly: the scene and the camera distance are
    // scaled by the same amount, so every projected point lands exactly that
    // much further out from the middle and the perspective is untouched. Scaling
    // the scene on its own would walk the camera in and steepen the whole thing,
    // which is what Distance is for.
    const zoom = Math.max(0.01, params.zoom);
    root.style.perspective = `${round(params.distance * zoom)}px`;
    root.style.perspectiveOrigin = "50% 50%";

    const cards = perRow();
    const centre = arrangementCentre(params, cards, visibleRange(params, cards));

    // The pitch pivots about the middle of the arrangement, not about the
    // focused card. A bowl recedes away from that card, so rotating about the
    // origin swings the near edge down out of frame and rears the far edge up —
    // which is not tipping a ring over, it is standing it on end. At pitch 0 the
    // pivot has no effect, so a coverflow is untouched.
    stage.style.transformOrigin = `50% 50% ${round(centre.z)}px`;
    // Read right to left. The centring slide comes before the zoom, so it is
    // plain screen pixels and works at any camera angle — inside the rotations it
    // would move a vertical track sideways instead of up — and it grows with the
    // picture rather than drifting off it.
    //
    // The scale turns about the stage's own origin, which sits `centre.z` deep,
    // while the camera looks from zero. translateZ makes up exactly that
    // difference, so the two agree and zooming only ever changes the size.
    stage.style.transform =
      `translateZ(${round(centre.z * (zoom - 1))}px) ` +
      `scale3d(${round(zoom)}, ${round(zoom)}, ${round(zoom)}) ` +
      `translateY(${round(centre.y)}px) ` +
      `rotateX(${round(params.pitch)}deg) rotateZ(${round(params.tilt)}deg)`;

    // A horizontal track leaves vertical page-scrolling alone; a vertical one
    // leaves horizontal alone. Either way the visitor keeps the axis we do not use.
    root.style.touchAction = runsVertically() ? "pan-x" : "pan-y";

    // When a card's own content shows, and how far its picture grows to make
    // room for it. Both are read by the stylesheet, so the reveal is CSS — which
    // is what makes it something the person who pastes this can redesign.
    root.dataset.cgReveal = params.cardReveal;
    root.dataset.cgContent = params.contentLayout;
    root.style.setProperty("--cg-reveal-zoom", String(round(params.revealZoom)));
    root.style.setProperty("--cg-cta-scale", String(round(params.buttonScale)));
    root.style.setProperty("--cg-text-scale", String(round(params.textScale)));
    root.style.setProperty("--cg-fit", String(round(contentFit())));
  }

  /**
   * Whether a card carrying an address is a link *at all* at these settings.
   *
   * A card with content set to never show has nothing on it to say it can be
   * clicked, so under the default it is not a link — not merely a link that
   * declines to fire. The difference is everything for anyone not looking at it:
   * a dead anchor is still announced as a link and still lands in the tab order,
   * which is a promise the carousel then breaks. Taking the href off leaves the
   * picture it looks like.
   */
  function linksAreLive(): boolean {
    if (params.cardLink === "never") return false;
    if (params.cardLink === "always") return true;
    return params.cardReveal !== "never";
  }

  /** Puts each card's address on or takes it off, following `cardLink`. */
  function applyLinks() {
    const live = linksAreLive();
    for (const slot of slots) {
      if (!slot.href) continue;
      if (live) slot.card.setAttribute("href", slot.href);
      else slot.card.removeAttribute("href");
    }
    root.dataset.cgLink = params.cardLink;
  }

  /**
   * How far to draw a card's words and button down from the size they were
   * tuned at.
   *
   * The panel used to be fixed pixels while the card was a slider, so shrinking
   * the card left 15px type on a card too small to hold it — at the narrowest
   * setting the text block stood two thirds taller than the whole card and most
   * of it was cropped away. Sizing it against the card instead keeps it the same
   * share of the picture at every setting.
   *
   * Both dimensions, not just the width: the panel overflows a squat card the
   * same way it overflows a narrow one, and the shape slider reaches 0.5. And
   * capped at 1, never above — the type was drawn at the tuned card and
   * magnifying past that has never been the thing anybody wanted. It is the same
   * rule the stage itself follows.
   */
  function contentFit(): number {
    const height = params.cardWidth * params.cardAspect;
    return Math.max(
      0.05,
      Math.min(1, params.cardWidth / TUNED_CARD.width, height / TUNED_CARD.height),
    );
  }

  function applyCardBox() {
    const width = params.cardWidth;
    const height = params.cardWidth * params.cardAspect;
    for (const slot of slots) {
      slot.item.style.width = `${round(width)}px`;
      slot.item.style.height = `${round(height)}px`;
      slot.item.style.marginLeft = `${round(-width / 2)}px`;
      slot.item.style.marginTop = `${round(-height / 2)}px`;
      slot.card.style.borderRadius = `${round(params.cardRadius)}px`;
      // Glass: a translucent card over its neighbours. Deliberately not
      // backdrop-filter — a per-frame blur of the backdrop for the same look.
      if (params.transparency > 0) {
        slot.card.style.background = `rgba(140, 145, 160, ${round(0.1 * params.transparency)})`;
        slot.card.style.boxShadow = `inset 0 0 0 1px rgba(255, 255, 255, ${round(0.18 * params.transparency)})`;
        slot.img.style.opacity = String(round(1 - 0.45 * params.transparency));
      } else {
        slot.card.style.background = "";
        slot.card.style.boxShadow = "";
        slot.img.style.opacity = "";
      }
    }
  }

  function render() {
    if (destroyed) return;
    const position = animator.position();
    const cards = perRow();
    const range = visibleRange(params, cards);
    const rings = params.rings.length > 0 ? params.rings : [SINGLE_RING];

    for (const slot of slots) {
      const ring = rings[slot.ring] ?? SINGLE_RING;
      const row = Math.floor(slot.index / cards);
      const indexInRow = slot.index % cards;
      const offset = wrappedOffset(indexInRow, ringPosition(position, ring), cards, params.loop);

      // Nearest the centre. Touched only when it changes, not sixty times a
      // second — a data attribute write invalidates style for the subtree.
      const focused = Math.abs(offset) < 0.5;
      if (focused !== slot.focused) {
        slot.focused = focused;
        if (focused) slot.item.dataset.cgFocused = "1";
        else delete slot.item.dataset.cgFocused;
      }

      if (Math.abs(offset) > range) {
        if (!slot.hidden) {
          slot.item.style.display = "none";
          slot.hidden = true;
        }
        continue;
      }
      if (slot.hidden) {
        slot.item.style.display = "";
        slot.hidden = false;
      }

      const v = cardVisual(params, offset, slot.index, cards, ring.scale, row, range);

      slot.item.style.transform =
        `translate3d(${round(v.x)}px, ${round(v.y)}px, ${round(v.z)}px) ` +
        `rotateX(${round(v.rotX)}deg) rotateY(${round(v.rotY)}deg) rotateZ(${round(v.rotZ)}deg) ` +
        `scale(${round(v.scale)})`;

      slot.card.style.opacity = String(round(v.opacity));
      // blur(0px) would still promote a layer and open a containing block, so
      // leave the property unset rather than writing a zero.
      slot.card.style.filter = v.blur > 0.01 ? `blur(${round(v.blur)}px)` : "";

      // The order to paint in, written out rather than left to the browser.
      // Chromium works it out from the depth and ignores this; Safari does the
      // reverse on any arrangement lying flat in the screen plane, and without
      // it draws those in document order — so the card coming into focus slides
      // *behind* its neighbours. Only written when it changes: the value moves
      // one card at a time, not sixty times a second.
      if (v.zIndex !== slot.zIndex) {
        slot.zIndex = v.zIndex;
        slot.item.style.zIndex = String(v.zIndex);
      }
    }

    // Arrows and dots follow the focused card, but only when it actually
    // changes — not sixty times a second while a tween is running.
    if (currentIndex() !== lastChromeIndex) updateChromeState();
  }

  /**
   * Where a given ring sits: the shared position, turned the ring's own way,
   * plus however far its own drift has carried it. A ring with negative drift
   * runs backwards through both — that is what makes two rings counter-rotate.
   */
  function ringPosition(position: number, ring: RingSpec): number {
    const direction = ring.drift < 0 ? -1 : 1;
    return position * direction + (ring.drift * driftClock) / 1000;
  }

  function anythingDrifts(): boolean {
    return params.rings.some((ring) => ring.drift !== 0);
  }

  /** The ring everything without a ring of its own is measured against. */
  function baseRing(): RingSpec {
    return params.rings[0] ?? SINGLE_RING;
  }

  /**
   * Drift still to come before the ring is at rest, in milliseconds of clock.
   *
   * Winding down is a straight ramp from `driftScale` to nothing over
   * `DRIFT_SPIN_DOWN_MS`, so it lasts `driftScale` of that and averages half of
   * it — the area under the ramp, and the extra the clock will have taken by
   * the time everything has stopped. Aiming without it lands the card short by
   * exactly that much.
   */
  function driftStillOwed(): number {
    return (driftScale * driftScale * DRIFT_SPIN_DOWN_MS) / 2;
  }

  /**
   * The position that will leave `ring` standing at `wanted` once it is still.
   *
   * The inverse of `ringPosition`, taken at rest rather than now. Steering a
   * drifting ring means solving for where the shared position has to end up
   * given where the ring's own turning will have carried it — the step that was
   * missing, and the reason a tap on a turning carousel landed a card or two
   * away and then kept going.
   *
   * With nothing drifting, `owed` is nothing and the direction is forwards, so
   * this is `wanted` and the arithmetic disappears.
   */
  function aimAt(wanted: number, ring: RingSpec): number {
    const direction = ring.drift < 0 ? -1 : 1;
    const atRest = (ring.drift * (driftClock + driftStillOwed())) / 1000;
    return (wanted - atRest) * direction;
  }

  /**
   * Give way to somebody steering, and start counting down to taking over.
   *
   * Every deliberate move calls this — a tap, an arrow, a dot, a key, a drag,
   * the wheel. Anything that does not is a control the carousel would turn out
   * from under, which is the bug this exists to answer.
   */
  function yieldDrift() {
    if (!anythingDrifts()) return;
    driftHold = DRIFT_HOLD_MS;
    startLoop();
  }

  /**
   * Somebody has asked for a particular card: stop turning and put it there.
   *
   * The one road for every deliberate move, so none of them can forget either
   * half. `wanted` is in the ring's own terms — where that ring must stand —
   * which is what is on screen, rather than the shared position underneath it.
   */
  function steerTo(wanted: number, ring: RingSpec = baseRing()) {
    yieldDrift();
    moveTo(aimAt(wanted, ring));
  }

  // --- the loop ----------------------------------------------------------

  let frame = 0;
  let onScreen = true;
  let lastFrameTime = 0;
  let autoplayClock = 0;
  /** Milliseconds of running time, which is what ring drift is measured against. */
  let driftClock = 0;
  /**
   * How much of its drift the ring is currently taking, 0 to 1.
   *
   * The clock is fed `delta * driftScale` rather than `delta`, so easing this
   * eases the turn without the position ever jumping: a clock that slows down
   * still only runs forwards.
   */
  let driftScale = 1;
  /** Milliseconds of stillness still owed before the drift creeps back. */
  let driftHold = 0;

  /**
   * Whether the cards are handed to the GPU as their own layers.
   *
   * `will-change: transform` is a promise that a thing is about to move, and the
   * browser pays for it up front. Left on permanently it is one promoted layer
   * per card parked in GPU memory — forty of them on the heaviest preset — for a
   * carousel that is sitting perfectly still. So it arrives with the movement
   * and leaves with it. One attribute on the root rather than forty inline
   * styles, because the rule that reads it can live in the stylesheet.
   */
  function setMoving(moving: boolean) {
    if (moving) root.dataset.cgMoving = "1";
    else delete root.dataset.cgMoving;
  }

  function stopLoop() {
    if (frame && view) view.cancelAnimationFrame(frame);
    frame = 0;
    lastFrameTime = 0;
    setMoving(false);
  }

  /**
   * Pick the loop back up after it was stopped for reasons of its own — hidden
   * tab, scrolled out of view, pointer leaving. The frame clock and the autoplay
   * clock both restart, so coming back does not dump a backlog of elapsed time
   * into one enormous jump.
   */
  function resumeLoop() {
    lastFrameTime = 0;
    autoplayClock = 0;
    startLoop();
  }

  /** True while something still needs frames even though the animator is at rest. */
  function needsFrames(): boolean {
    if (dragging || reduced) return false;
    if (anythingDrifts()) return true;
    return params.autoplay && !isPaused();
  }

  /** Nobody is looking, so nothing should be costing frames. */
  function unwatched(): boolean {
    return !onScreen || doc.visibilityState === "hidden";
  }

  function step(time: number) {
    frame = 0;
    const delta = lastFrameTime ? Math.min(100, time - lastFrameTime) : 0;
    lastFrameTime = time;

    if (anythingDrifts() && !reduced) {
      if (driftHold > 0) {
        driftScale = Math.max(0, driftScale - delta / DRIFT_SPIN_DOWN_MS);
        // The hold is time spent *still*, so it only starts counting down once
        // the ring has actually stopped — otherwise the wind-down eats it.
        if (driftScale === 0) driftHold = Math.max(0, driftHold - delta);
      } else {
        driftScale = Math.min(1, driftScale + delta / DRIFT_SPIN_UP_MS);
      }
      driftClock += delta * driftScale;
    }
    const busy = animator.tick(time);

    if (params.autoplay && !reduced && !isPaused() && animator.settled()) {
      autoplayClock += delta;
      if (autoplayClock >= Math.max(200, params.autoplayInterval)) {
        autoplayClock = 0;
        advance(1);
      }
    }

    render();
    if (busy || needsFrames()) startLoop();
    else setMoving(false);
  }

  function startLoop() {
    if (destroyed || frame || !view || unwatched()) return;
    setMoving(true);
    frame = view.requestAnimationFrame(step);
  }

  // --- moving ------------------------------------------------------------

  function now(): number {
    return view?.performance?.now() ?? Date.now();
  }

  function clampTarget(target: number): number {
    if (params.loop || count === 0) return target;
    return Math.max(0, Math.min(count - 1, target));
  }

  function moveTo(target: number) {
    if (destroyed || count === 0) return;
    animator.goTo(clampTarget(target), now());
    render();
    startLoop();
  }

  /**
   * The card in the middle — which on a drifting ring is not the card the
   * position alone names. Leaving the drift out of this pinned the dots to the
   * first card for as long as the carousel turned.
   */
  function currentIndex(): number {
    if (count === 0) return 0;
    const cards = perRow();
    const raw = Math.round(ringPosition(animator.target(), baseRing()));
    if (!params.loop) return Math.max(0, Math.min(cards - 1, raw));
    return ((raw % cards) + cards) % cards;
  }

  /** One card on from whatever is on screen, rather than from the bare position. */
  function advance(delta: number) {
    const ring = baseRing();
    steerTo(Math.round(ringPosition(animator.target(), ring)) + delta, ring);
  }

  // --- listeners ---------------------------------------------------------

  type Unbind = () => void;
  const unbinds: Unbind[] = [];

  function bind(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): Unbind {
    target.addEventListener(type, handler, options);
    return () => target.removeEventListener(type, handler, options);
  }

  // --- drag --------------------------------------------------------------

  let dragging = false;
  let hovered = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPosition = 0;
  let pressedOn: Slot | null = null;
  let travelled = 0;
  /** Whether this gesture has taken the pointer yet. See `capturePointer`. */
  let captured = false;
  /** Read by the click that follows a release, to decide whether a link fires. */
  let lastGestureWasDrag = false;
  let stepPx = params.spacing;
  let samples: { x: number; t: number }[] = [];

  function isPaused(): boolean {
    return dragging || (hovered && params.pauseOnHover);
  }

  /**
   * The track's direction on screen. The scene's roll turns a horizontal track
   * into a vertical or diagonal one, and input has to follow it — otherwise a
   * vertical carousel is dragged sideways, which is nonsense.
   */
  function trackAxis(): { along: (dx: number, dy: number) => number; across: (dx: number, dy: number) => number } {
    const tilt = (params.tilt * Math.PI) / 180;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    return {
      along: (dx, dy) => dx * cos + dy * sin,
      across: (dx, dy) => -dx * sin + dy * cos,
    };
  }

  /** True once the track is more vertical than horizontal. */
  function runsVertically(): boolean {
    return Math.abs(Math.sin((params.tilt * Math.PI) / 180)) > Math.SQRT1_2;
  }

  function eventTime(event: Event): number {
    return typeof event.timeStamp === "number" && event.timeStamp > 0 ? event.timeStamp : now();
  }

  /**
   * Screen pixels per card. Measured on pointerdown rather than cached per
   * resize: one rect read per gesture is free, and it can never be stale — the
   * layout width against the painted width is the transform actually in force,
   * mid-transition included.
   */
  function measureStepPx(): number {
    const rect = root.getBoundingClientRect();
    const layout = root.offsetWidth;
    const scale = layout > 0 && rect.width > 0 ? rect.width / layout : 1;
    // Zoom is on the stage rather than the root, so it is not in that measured
    // ratio — a zoomed-in carousel would otherwise travel further than the finger.
    return Math.max(8, params.spacing * Math.max(0.01, params.zoom) * scale);
  }

  /**
   * Velocity in cards/ms from the last three samples, not the last two: a
   * finger that came to rest before letting go reads as a flick if you only
   * look at the final pair.
   */
  function releaseVelocity(endTime: number): number {
    const recent = samples.slice(-3).filter((s) => endTime - s.t <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const span = last.t - first.t;
    if (span <= 0) return 0;
    return -(last.x - first.x) / span / stepPx;
  }

  /** Which card, if any, the event landed on. */
  function slotFromEvent(event: Event): Slot | null {
    if (!(event.target instanceof Element)) return null;
    const item = event.target.closest(".cg-item");
    return item ? (slots.find((slot) => slot.item === item) ?? null) : null;
  }

  function onPointerDown(event: Event) {
    const e = event as PointerEvent;
    if (count === 0) return;
    if (typeof e.button === "number" && e.button !== 0) return;
    // A press on an arrow or a dot is a press on that control, not a drag.
    // Taking pointer capture here retargets every later pointer event to the
    // root, so the button never sees its own pointerup and the browser never
    // generates a click — the arrows just silently stop working.
    if (event.target instanceof Element && event.target.closest(".cg-arrow, .cg-dot")) return;

    // A hand on the carousel is the clearest "I am steering this" there is, so
    // the drift gives way at the press rather than waiting to see whether the
    // gesture turns out to be a tap or a drag. A drag stops the loop below and
    // freezes the drift outright; this is what keeps it stopped after the
    // release, so a flick is not immediately turned out from under.
    yieldDrift();

    // Tapping works whether or not dragging does, so this is recorded first.
    pressedOn = params.tapToFocus ? slotFromEvent(event) : null;
    travelled = 0;
    if (!params.drag) {
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      return;
    }
    dragging = true;
    stopLoop();
    stepPx = measureStepPx();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPosition = animator.position();
    samples = [{ x: trackAxis().along(0, 0), t: eventTime(e) }];
    root.setAttribute("data-cg-dragging", "1");
    // Deliberately no setPointerCapture here. See `capturePointer`.
    captured = false;
  }

  /**
   * Take the pointer, but only once the press has become a real drag.
   *
   * Capture retargets every later pointer event for that pointer to the element
   * holding it — which is the whole point during a drag, and fatal before one.
   * The browser only synthesises a `click` where the press and the release land
   * on the same element, and with the root holding capture from `pointerdown`
   * that element is always the root. So the anchor a linked card is made of
   * never saw a click, and a carousel whose cards had real web addresses on them
   * went nowhere when you tapped one. Nothing in the console, and switching drag
   * off "fixed" it, which sends you looking in the wrong place entirely.
   *
   * docs/web-build-gotchas.md has this trap for buttons over a drag surface, and
   * its fix — decline the drag when the press starts on a control — is what the
   * arrows and dots use above. It cannot work here: the card *is* the drag
   * surface, and declining would stop you dragging the carousel by its cards.
   * Waiting instead costs nothing, because capture only matters once the pointer
   * leaves the element, which it cannot have done inside eight pixels.
   *
   * A tap therefore never captures at all, and `onClick` is left to decide
   * whether the link fires — which is where that decision belongs.
   */
  function capturePointer(pointerId: number) {
    if (captured) return;
    captured = true;
    try {
      root.setPointerCapture?.(pointerId);
    } catch {
      // Not available (or no such pointer) — drag still works inside the element.
    }
  }

  /**
   * A linked card, and whether this particular press was allowed to follow it.
   *
   * Two ways it is not. A drag that happens to finish over a card is not a
   * request to leave the page — it is how you look at the next picture, and on a
   * touch screen every swipe ends on top of something. And where tapping brings
   * a card to the middle, a tap on a card that is *not* in the middle means
   * "bring that one here"; only the one already in the middle follows its link.
   * That is the coverflow convention and it is what people expect.
   */
  function onClick(event: Event) {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest(".cg-card");
    // No href means there is nothing to stop — a card the settings have made
    // dormant is a plain element and the browser will not navigate anyway.
    if (!card || !card.hasAttribute("href")) return;
    const slot = slots.find((entry) => entry.card === card);
    if (!slot) return;
    if (lastGestureWasDrag || (params.tapToFocus && !slot.focused) || !showsItsContent(slot)) {
      event.preventDefault();
    }
  }

  /**
   * Whether this card's own words are on screen at the moment it was clicked.
   *
   * Only asked under "With content", and only ever narrows what a tap does. The
   * hovering cases answer themselves: a click arrives through the pointer, so
   * the card under it is the hovered one by definition.
   *
   * It matters in one case the `href` alone cannot cover. With the reveal set to
   * Centred, *every* card is a link — they all reveal when their turn comes, and
   * dropping the others out of the tab order as the carousel turned would be a
   * page whose links move about. But only the centred one is showing anything,
   * so only the centred one should travel. Tap-to-centre already says as much
   * where it is switched on; this is what says it where it is not.
   */
  function showsItsContent(slot: Slot): boolean {
    if (params.cardLink !== "content") return true;
    if (params.cardReveal === "never") return false;
    return params.cardReveal === "focus" ? slot.focused : true;
  }

  function onPointerMove(event: Event) {
    const e = event as PointerEvent;
    const moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
    if (moved > travelled) travelled = moved;
    if (!dragging) return;
    // Past the slop this is a drag rather than a tap, so it is worth the pointer
    // now — and taking it here rather than on the press is what leaves a linked
    // card's anchor able to see its own click.
    if (travelled > TAP_SLOP_PX) capturePointer(e.pointerId);
    // Only the movement along the track counts; across it is ignored, so a
    // vertical swipe past a horizontal carousel scrolls the page as it should.
    const along = trackAxis().along(e.clientX - dragStartX, e.clientY - dragStartY);
    animator.set(dragStartPosition - along / stepPx);
    samples.push({ x: along, t: eventTime(e) });
    if (samples.length > 4) samples.shift();
    render();
  }

  function onPointerUp(event: Event) {
    const e = event as PointerEvent;
    travelled = Math.max(travelled, Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY));

    // A press and release on one card, with the pointer essentially still, is a
    // tap: bring that card to the centre. Anything further is a drag, and its
    // release belongs to the fling below.
    const tapped = pressedOn;
    pressedOn = null;
    lastGestureWasDrag = travelled > TAP_SLOP_PX;
    if (tapped && travelled <= TAP_SLOP_PX) {
      const cards = perRow();
      dragging = false;
      root.removeAttribute("data-cg-dragging");
      // On a loop the tapped card exists at every lap of the track, and the
      // copy the visitor pointed at is the one nearest to where the track is
      // now — its base index would rewind the whole thing to the first lap.
      //
      // "Where the track is now" has to be read off the ring the tapped card
      // belongs to, drift and all: on a counter-turning second ring the shared
      // position is not even running the same way.
      const ring = params.rings[tapped.ring] ?? SINGLE_RING;
      const base = tapped.index % cards;
      const here = ringPosition(animator.position(), ring);
      const lap = params.loop ? Math.round((here - base) / cards) : 0;
      steerTo(base + lap * cards, ring);
      return;
    }

    if (!dragging) return;
    dragging = false;
    root.removeAttribute("data-cg-dragging");
    if (captured) {
      captured = false;
      try {
        root.releasePointerCapture?.(e.pointerId);
      } catch {
        // Already released.
      }
    }
    // Velocity comes off the event clock (a difference, so its origin does not
    // matter); the tween is started on the frame clock the loop will read.
    animator.fling(releaseVelocity(eventTime(e)), now());
    autoplayClock = 0;
    render();
    startLoop();
  }

  function onKeyDown(event: Event) {
    const e = event as KeyboardEvent;
    if (count === 0) return;
    // Left and right always work. Up and down only when the track is actually
    // vertical — on a horizontal one they are the visitor's page-scroll keys.
    const vertical = runsVertically();
    if (e.key === "ArrowRight" || (vertical && e.key === "ArrowDown")) {
      e.preventDefault();
      advance(1);
    } else if (e.key === "ArrowLeft" || (vertical && e.key === "ArrowUp")) {
      e.preventDefault();
      advance(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      steerTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      steerTo(count - 1);
    }
  }

  let wheelReadyAt = 0;

  function onWheel(event: Event) {
    const e = event as WheelEvent;
    const axis = trackAxis();
    const along = axis.along(e.deltaX, e.deltaY);
    // Only a gesture predominantly along the track is ours. Anything across it
    // belongs to the visitor's page, and taking that is hostile.
    if (Math.abs(along) <= Math.abs(axis.across(e.deltaX, e.deltaY))) return;
    e.preventDefault();
    const time = eventTime(e);
    if (time < wheelReadyAt) return;
    if (Math.abs(along) < WHEEL_THRESHOLD) return;
    wheelReadyAt = time + WHEEL_COOLDOWN_MS;
    advance(along > 0 ? 1 : -1);
  }

  let wheelUnbind: Unbind | null = null;

  function syncWheel() {
    if (params.wheel && !wheelUnbind) {
      wheelUnbind = bind(root, "wheel", onWheel, { passive: false });
    } else if (!params.wheel && wheelUnbind) {
      wheelUnbind();
      wheelUnbind = null;
    }
  }

  // --- arrows and dots ---------------------------------------------------

  let arrowsBox: HTMLDivElement | null = null;
  let prevButton: HTMLButtonElement | null = null;
  let nextButton: HTMLButtonElement | null = null;
  let arrowUnbinds: Unbind[] = [];

  let dotsBox: HTMLDivElement | null = null;
  let dotButtons: HTMLButtonElement[] = [];
  let dotTargets: number[] = [];
  let dotUnbinds: Unbind[] = [];

  function buildArrows() {
    arrowsBox = doc.createElement("div");
    arrowsBox.className = "cg-arrows";

    prevButton = doc.createElement("button");
    prevButton.type = "button";
    prevButton.className = "cg-arrow cg-arrow--prev";
    prevButton.setAttribute("aria-label", "Previous");
    prevButton.textContent = "‹";

    nextButton = doc.createElement("button");
    nextButton.type = "button";
    nextButton.className = "cg-arrow cg-arrow--next";
    nextButton.setAttribute("aria-label", "Next");
    nextButton.textContent = "›";

    arrowUnbinds = [
      bind(prevButton, "click", () => advance(-1)),
      bind(nextButton, "click", () => advance(1)),
    ];

    arrowsBox.append(prevButton, nextButton);
    root.appendChild(arrowsBox);
  }

  function removeArrows() {
    arrowUnbinds.forEach((off) => off());
    arrowUnbinds = [];
    arrowsBox?.remove();
    arrowsBox = null;
    prevButton = null;
    nextButton = null;
  }

  function buildDots() {
    const cards = perRow();
    const wanted = Math.min(cards, MAX_DOTS);
    dotsBox = doc.createElement("div");
    dotsBox.className = "cg-dots";
    dotButtons = [];
    dotTargets = [];
    dotUnbinds = [];

    for (let i = 0; i < wanted; i++) {
      // A longer set gets evenly spread dots rather than a hundred of them.
      const target = wanted > 1 ? Math.round((i * (cards - 1)) / (wanted - 1)) : 0;
      const dot = doc.createElement("button");
      dot.type = "button";
      dot.className = "cg-dot";
      dot.setAttribute("aria-label", `Go to card ${target + 1}`);
      dotUnbinds.push(bind(dot, "click", () => steerTo(target)));
      dotButtons.push(dot);
      dotTargets.push(target);
      dotsBox.appendChild(dot);
    }
    root.appendChild(dotsBox);
  }

  function removeDots() {
    dotUnbinds.forEach((off) => off());
    dotUnbinds = [];
    dotsBox?.remove();
    dotsBox = null;
    dotButtons = [];
    dotTargets = [];
  }

  function syncChrome() {
    if (params.arrows && !arrowsBox) buildArrows();
    else if (!params.arrows && arrowsBox) removeArrows();

    if (params.dots && !dotsBox) buildDots();
    else if (!params.dots && dotsBox) removeDots();

    root.toggleAttribute("data-cg-drag", params.drag);
    root.toggleAttribute("data-cg-tap", params.tapToFocus);
    updateChromeState();
  }

  let lastChromeIndex = -1;

  function updateChromeState() {
    const index = currentIndex();
    if (prevButton && nextButton) {
      prevButton.disabled = !params.loop && index <= 0;
      nextButton.disabled = !params.loop && index >= perRow() - 1;
    }
    if (dotButtons.length > 0) {
      let nearest = 0;
      for (let i = 1; i < dotTargets.length; i++) {
        if (Math.abs(dotTargets[i] - index) < Math.abs(dotTargets[nearest] - index)) nearest = i;
      }
      dotButtons.forEach((dot, i) => dot.setAttribute("aria-current", i === nearest ? "true" : "false"));
    }
    lastChromeIndex = index;
  }

  // --- first paint -------------------------------------------------------

  root.setAttribute("tabindex", "0");
  root.classList.toggle("cg-root--reduced", reduced);

  function onMotionPreferenceChange(event: MediaQueryListEvent) {
    reduced = event.matches === true;
    refreshMotionParams();
    root.classList.toggle("cg-root--reduced", reduced);
    render();
    if (needsFrames()) startLoop();
  }

  if (motionQuery) {
    const handler = onMotionPreferenceChange as (event: MediaQueryListEvent) => void;
    if (typeof motionQuery.addEventListener === "function") {
      unbinds.push(bind(motionQuery, "change", handler as EventListener));
    } else if (typeof motionQuery.addListener === "function") {
      // Safari before 14.
      motionQuery.addListener(handler);
      unbinds.push(() => motionQuery?.removeListener(handler));
    }
  }

  unbinds.push(
    bind(root, "pointerdown", onPointerDown),
    bind(root, "pointermove", onPointerMove),
    bind(root, "pointerup", onPointerUp),
    bind(root, "pointercancel", onPointerUp),
    bind(root, "click", onClick),
    bind(root, "keydown", onKeyDown),
    bind(root, "pointerenter", () => {
      hovered = true;
    }),
    bind(root, "pointerleave", () => {
      hovered = false;
      resumeLoop();
    }),
    bind(doc, "visibilitychange", () => {
      if (doc.visibilityState === "hidden") stopLoop();
      else resumeLoop();
    }),
  );

  // A carousel scrolled past is a carousel nobody is watching. Stopping the loop
  // is the difference between a page with three of these on it costing three
  // continuous animations and costing none.
  let observer: IntersectionObserver | null = null;
  if (view && typeof view.IntersectionObserver === "function") {
    try {
      observer = new view.IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        if (onScreen) resumeLoop();
        else stopLoop();
      });
      observer.observe(root);
    } catch {
      observer = null;
      onScreen = true;
    }
  }

  applySceneStyles();
  applyCardBox();
  applyLinks();
  syncWheel();
  syncChrome();
  render();
  if (needsFrames()) startLoop();

  return {
    // Deliberately the same road the arrows take, rather than a second copy
    // of the arithmetic that would not know about the drift.
    next: () => advance(1),
    prev: () => advance(-1),
    goTo: (index: number) => steerTo(index),

    setParams(partial) {
      if (destroyed) return;
      params = { ...params, ...partial };
      refreshMotionParams();
      const wantedRings = Math.max(1, params.rings.length);
      if (wantedRings !== builtRings) buildSlots(wantedRings);
      applySceneStyles();
      applyCardBox();
      applyLinks();
      syncWheel();
      syncChrome();
      render();
      // A snapping carousel found resting between cards settles onto the
      // nearest one, with its own easing. The one road here is a rebuild
      // seeded mid-turn from a drifting style: the new arrangement takes over
      // at the old ring's exact angle, and this carries it the last half-card
      // home alongside whatever else the parameter change set moving.
      if (params.snap && !dragging && animator.settled()) {
        const resting = animator.position();
        if (Math.abs(resting - Math.round(resting)) > 1e-6) moveTo(Math.round(resting));
      }
      if (needsFrames()) startLoop();
    },

    params: () => params,
    index: currentIndex,
    position: () => animator.position(),
    phase: () => {
      const cards = perRow();
      const raw = ringPosition(animator.position(), params.rings[0] ?? SINGLE_RING);
      return ((raw % cards) + cards) % cards;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      observer?.disconnect();
      observer = null;
      unbinds.forEach((off) => off());
      unbinds.length = 0;
      wheelUnbind?.();
      wheelUnbind = null;
      removeArrows();
      removeDots();
      stage.remove();
      root.classList.remove("cg-root", "cg-root--reduced");
      root.style.removeProperty("perspective");
      root.style.removeProperty("perspective-origin");
      root.removeAttribute("tabindex");
      root.removeAttribute("data-cg-drag");
      root.removeAttribute("data-cg-tap");
      root.removeAttribute("data-cg-dragging");
      if (root.getAttribute("style") === "") root.removeAttribute("style");
      occupied.delete(root);
    },
  };
}
