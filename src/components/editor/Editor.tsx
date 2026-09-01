"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { CarouselPreview } from "@/components/CarouselPreview";
import type { CarouselInstance } from "@/engine/controller";
import { BACKDROP, PRESET_TWEEN_MS } from "@/components/previewStage";
import type { Backdrop } from "@/components/previewStage";
import { COPY } from "@/data/copy";
import { IMAGES } from "@/data/images";
import { PRESETS, presetBySlug, presetParams } from "@/engine/presets";
import type { CarouselParams } from "@/engine/types";
import { BackdropToggle } from "./BackdropToggle";
import { blendParams, settle } from "./blend";
import { ControlPanel } from "./ControlPanel";
import { Drawer } from "./Drawer";
import { DrawerHeader } from "./DrawerHeader";
import { ExportMenu } from "./ExportMenu";
import { StageFrame } from "./StageFrame";
import type { StageHandle } from "./StageFrame";

/**
 * Stands in for the parameters while a style is walking to its new values, so
 * the framing holds still until they arrive.
 *
 * The fit measures what is on screen, and half way through a morph what is on
 * screen is neither style. Worse, it is often *smaller* than either: the cards
 * that fade out on the way have gone, and the ones that fade in have not
 * arrived, so the arrangement measures narrow and the camera rushes in to fill
 * the gap. Diagonal descent swelled to 1.52× and then pulled back to 1.32,
 * which is what "it suddenly gets massive" was.
 *
 * A drag is not a morph and is not affected — nothing is tweening, so the
 * framing tracks the slider live, which is the whole point of it.
 */


// The panel is rendered on a phone but not driven there — spec §10. One flag, so
// it can be switched on later without a rebuild.
const PHONE_QUERY = "(max-width: 1023px)";
const subscribePhone = (notify: () => void) => {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const phoneNow = () => window.matchMedia(PHONE_QUERY).matches;
const phoneOnServer = () => false;

/**
 * Whether the drawer is open, held for as long as the page is loaded and no
 * longer.
 *
 * Every desktop load starts open: the tools are the reason the page exists, and
 * somebody who never sees them does not know to look for them. Folding it away
 * is a decision about the next minute, not about the next visit, so nothing is
 * written down — a reload opens it again. A phone still starts shut, where the
 * panel would cover the carousel with sliders that do not move anyway.
 *
 * An external store rather than state so the open/shut answer can be read
 * during render on the server and on the client without an effect correcting it
 * afterwards.
 */
// Null until somebody folds or unfolds it, which is what lets the default below
// answer for the screen it turns out to be on.
let chosen: boolean | null = null;
const drawerListeners = new Set<() => void>();
const subscribeDrawer = (notify: () => void) => {
  drawerListeners.add(notify);
  return () => {
    drawerListeners.delete(notify);
  };
};
const drawerNow = () => chosen ?? !window.matchMedia(PHONE_QUERY).matches;
const drawerOnServer = () => true;
const setDrawer = (open: boolean) => {
  chosen = open;
  drawerListeners.forEach((notify) => notify());
};

export interface EditorProps {
  /**
   * Which style to open on. Anything the styles do not answer to opens on the
   * first one.
   *
   * Read when the editor mounts and never again — a later change to it is
   * ignored, because the visitor has been moving the dials since. Sending
   * somebody to a different style means a fresh editor, so a route that swaps
   * this without remounting has to say so.
   */
  openingSlug?: string;
}

export function Editor({ openingSlug }: EditorProps) {
  // Where a link lands you. The slug comes off a web address, so it is whatever
  // somebody typed or mistyped, and presetParams throws on a name it does not
  // have — a wrong one has to open on the first style rather than on an error
  // page.
  //
  // It seeds the state below and is never pushed into it again. Arriving at a
  // different style is a new page load here, so a resync would have nothing to
  // do except overwrite the visitor's own edits.
  const opening = (openingSlug ? presetBySlug(openingSlug) : undefined) ?? PRESETS[0];

  const [slug, setSlug] = useState<string>(opening.slug);
  const [edited, setEdited] = useState(false);
  const [params, setParams] = useState<CarouselParams>(() => presetParams(opening.slug));
  const [query, setQuery] = useState("");
  const [bare, setBare] = useState(false);
  // Null means "whatever the style came with". Set once and it sticks across
  // styles, because somebody who has asked for a dark page meant it.
  const [backdrop, setBackdrop] = useState<Backdrop | null>(null);
  const [morphing, setMorphing] = useState(false);
  // The settings as they last stood still. The framing keeps looking at this
  // one while a morph is under way, and because it is the *same* value it was
  // already looking at, entering a morph triggers no re-measure — starting to
  // move is not new information about how the arrangement should be framed.
  const [settledKey, setSettledKey] = useState<CarouselParams>(params);

  // The live engine and the box it is drawn in, so a style change can find out
  // how big its destination wants to be *before* walking there.
  const stage = useRef<StageHandle>(null);
  const engine = useRef<CarouselInstance | null>(null);

  // The live preview and a layer over it for the dissolve below.
  const liveHost = useRef<HTMLDivElement>(null);
  const ghostLayer = useRef<HTMLDivElement>(null);
  const ghostTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (ghostTimer.current !== null) clearTimeout(ghostTimer.current);
    },
    [],
  );

  /**
   * Dissolve away a frozen copy of what is on screen right now.
   *
   * A style change that alters the card count cannot morph through it — a card
   * is there or it is not, and a 24-card ring is geometrically a bigger circle
   * than a 16-card one — so the moment the new set arrives is a cut, however
   * well everything after it travels. The cut hides behind this: the old
   * picture is cloned exactly as painted (inline styles and all, static), laid
   * over the stage, and faded out while the new arrangement morphs underneath.
   * The clone lives inside the same scaled box as the live preview, so it
   * rides the camera glide rather than hanging frozen while the scene moves.
   *
   * Cloned nodes carry no listeners and the layer takes no pointer events, so
   * it is scenery for a quarter of a second and then it is gone.
   */
  const dissolveFrom = useCallback((snapshot: HTMLElement) => {
    const layer = ghostLayer.current;
    if (!layer) return;
    if (ghostTimer.current !== null) clearTimeout(ghostTimer.current);

    const ghost = snapshot.cloneNode(true) as HTMLElement;
    layer.replaceChildren(ghost);
    layer.style.transition = "none";
    layer.style.opacity = "1";
    // Two frames, not one: the transition must not start in the same style
    // flush that set opacity back to 1, or it never runs at all.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layer.style.transition = "opacity 260ms ease-out";
        layer.style.opacity = "0";
      });
    });
    ghostTimer.current = window.setTimeout(() => {
      layer.replaceChildren();
      ghostTimer.current = null;
    }, 320);
  }, []);

  const isPhone = useSyncExternalStore(subscribePhone, phoneNow, phoneOnServer);
  const open = useSyncExternalStore(subscribeDrawer, drawerNow, drawerOnServer);

  const preset = presetBySlug(slug) ?? opening;
  const surface: Backdrop = backdrop ?? preset.background;
  const baseline = useMemo(() => presetParams(preset.slug), [preset.slug]);
  // The demo cards carry placeholder words so "Show content" has something to
  // show, and a placeholder web address so the button is a button rather than a
  // picture of one — until it had one, the only way to find out whether links
  // worked at all was to paste the code somewhere and wire one up. It opens in a
  // new tab: a link that replaced the page would walk the visitor off the tool,
  // which is why there wasn't one here before.
  const items = useMemo(
    () =>
      IMAGES.slice(0, preset.cards).map((image, i) => ({
        ...image,
        title: `${COPY.sampleCard.title} ${String(i + 1).padStart(2, "0")}`,
        caption: COPY.sampleCard.caption,
        cta: COPY.sampleCard.cta,
        href: COPY.sampleCard.href,
        newTab: true,
      })),
    [preset.cards],
  );

  // --- the shell ----------------------------------------------------------

  // --- picking a style ---------------------------------------------------
  const tween = useRef<number | null>(null);

  // Where the sliders are right now, for a tween to start from. Kept in an
  // effect rather than written during render: `pick` is an event handler, so by
  // the time it reads this the effect for the current render has long run.
  const liveParams = useRef(params);
  useEffect(() => {
    liveParams.current = params;
  }, [params]);

  useEffect(
    () => () => {
      if (tween.current !== null) cancelAnimationFrame(tween.current);
    },
    [],
  );

  /** Walk the sliders to a new set of values, in front of you. */
  const walkTo = useCallback((target: CarouselParams) => {
    const from = liveParams.current;
    if (tween.current !== null) cancelAnimationFrame(tween.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setParams(target);
      setMorphing(false);
      return;
    }

    setSettledKey(from);
    setMorphing(true);

    // Ask the destination how it wants to be framed, before setting off.
    //
    // The camera cannot follow a morph honestly: half way through, what is on
    // screen is neither style, and measuring it sent the picture the wrong way
    // and back. Waiting until the end was worse — the cards arrived, and then
    // the whole scene jumped 59% in a tenth of a second, which is what Danny
    // saw as "it locates into place and then gets really big".
    //
    // So the engine is asked to draw the destination, measured, and put back,
    // all inside this one call. setParams writes its styles synchronously and
    // the engine deliberately puts no transition on a card's transform, so the
    // rectangles read back are the real ones and nothing is ever painted in
    // between. Now the camera knows where it is going and can leave with the
    // cards rather than after them.
    //
    // The measurement runs against the destination's own card count: `pick`
    // commits the new style's cards before calling here. Measured with the old
    // count instead, the styles that keep every card visible answered wrongly
    // by however many cards the two styles differ — a Vortex asked to draw
    // itself with Concave arc's seven cards is a fraction of a ring, and the
    // camera flew to a size no real arrangement has, then corrected on
    // arrival. That correction was "it settles and then resizes itself".
    //
    // Measured at the destination's own Zoom too, for the same reason: the
    // engine has just drawn at that zoom, and dividing it out with the old
    // one misreads the arrangement by exactly the ratio between them.
    const preview = engine.current;
    const destination = (() => {
      if (!preview || !stage.current) return null;
      preview.setParams(target);
      const fit = stage.current.measure(target.zoom);
      preview.setParams(from);
      return fit;
    })();
    if (destination !== null) stage.current?.glide(destination, PRESET_TWEEN_MS);

    const started = performance.now();
    const step = (now: number) => {
      const k = settle((now - started) / PRESET_TWEEN_MS);
      setParams(blendParams(from, target, k));
      if (k < 1) {
        tween.current = requestAnimationFrame(step);
      } else {
        tween.current = null;
        setMorphing(false);
      }
    };
    tween.current = requestAnimationFrame(step);
  }, []);

  const pick = useCallback(
    (next: string) => {
      // A different card count means the switch opens on a cut — see
      // dissolveFrom. The snapshot is taken before anything changes, and only
      // when there is a cut to hide: a same-count switch morphs continuously
      // and dimming its first quarter-second would be pure loss.
      const destination = presetBySlug(next);
      const countChanges = destination !== undefined && destination.cards !== items.length;
      const snapshot =
        countChanges && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? liveHost.current
          : null;
      if (snapshot) dissolveFrom(snapshot);

      // Committed synchronously so the new style's cards exist before walkTo
      // measures its destination — a synchronous flush here reaches the
      // preview's layout effect, which rebuilds the card set in the same
      // breath. The cards arrive drawn with the *current* settings, so nothing
      // visibly changes until the walk starts; they are simply the right
      // number of cards for the measurement to be honest about.
      flushSync(() => {
        setSlug(next);
        setEdited(false);
      });
      walkTo(presetParams(next));
    },
    [walkTo, items.length, dissolveFrom],
  );

  const resetAll = useCallback(() => {
    setEdited(false);
    walkTo(presetParams(preset.slug));
  }, [preset.slug, walkTo]);

  // --- moving a slider ---------------------------------------------------
  const change = useCallback((patch: Partial<CarouselParams>) => {
    if (tween.current !== null) {
      cancelAnimationFrame(tween.current);
      tween.current = null;
      setMorphing(false);
    }
    setEdited(true);
    setParams((current) => ({ ...current, ...patch }));
  }, []);

  // --- clearing the screen -------------------------------------------------
  // H takes everything but the carousel away, for a screenshot or for showing
  // somebody. Any key at all brings it back, so nobody can get stuck behind it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (bare) {
        setBare(false);
        return;
      }
      if (event.key === "h" || event.key === "H") setBare(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bare]);

  return (
    // Fills whatever box the caller gives it, and never the viewport directly:
    // one contract, so this is a whole screen under FullScreenStage and a figure
    // in the middle of a page anywhere else. It is a div rather than a <main>
    // for the same reason — the page it lands on already has one.
    //
    // The scene's own colour runs behind the whole shell, so the 26px the
    // closed drawer occupies is invisible and the notch floats on the picture
    // rather than sitting on a black band down the edge of a light style.
    <div
      className="absolute inset-0 flex overflow-hidden"
      style={{
        backgroundColor: BACKDROP[surface],
        transition: `background-color ${PRESET_TWEEN_MS}ms linear`,
      }}
    >
      <div
        className="relative min-w-0 flex-1"
        onPointerDown={() => {
          if (bare) setBare(false);
        }}
      >
        <StageFrame
          background={surface}
          zoom={params.zoom}
          fitKey={morphing ? settledKey : params}
          handle={stage}
        >
          <div ref={liveHost} className="absolute inset-0">
            <CarouselPreview
              items={items}
              params={params}
              onReady={(instance) => {
                engine.current = instance;
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          {/* The dissolve's layer. `cg-ghost` keeps its cloned cards out of the
              framing measurement, and no pointer ever reaches it. */}
          <div
            ref={ghostLayer}
            className="cg-ghost pointer-events-none absolute inset-0"
            aria-hidden
            style={{ opacity: 0 }}
          />
        </StageFrame>

        <div
          className="pointer-events-none absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 transition-opacity duration-200 motion-reduce:transition-none"
          style={{ opacity: bare ? 0 : 1 }}
        >
          <div className={bare ? "pointer-events-none" : "pointer-events-auto"}>
            <ExportMenu params={params} items={items} preset={preset} onPreset={!edited} />
          </div>
          <div className={bare ? "pointer-events-none" : "pointer-events-auto"}>
            <BackdropToggle value={surface} onChange={setBackdrop} />
          </div>
        </div>
      </div>

      <Drawer open={open} onOpenChange={setDrawer} hidden={bare}>
        <DrawerHeader
          active={slug}
          edited={edited}
          onPick={pick}
          onReset={resetAll}
          onClose={() => setDrawer(false)}
          query={query}
          onQuery={setQuery}
        />

        {isPhone ? (
          <p className="shrink-0 border-b border-cg-line bg-cg-raised px-4 py-3 text-[11.5px] leading-relaxed text-cg-muted">
            The sliders adjust on a desktop. Everything below is what this style is made of — and
            the button in the corner still copies it out.
          </p>
        ) : null}

        <div
          className={`cg-scroll cg-scroll-fade relative z-[1] min-h-0 flex-1 overflow-y-auto pb-28 pt-3 ${
            isPhone ? "pointer-events-none select-none opacity-45" : ""
          }`}
          aria-hidden={isPhone || undefined}
        >
          <ControlPanel
            params={params}
            baseline={baseline}
            onChange={change}
            cards={items.length}
            query={query}
            disabled={isPhone}
          />
        </div>
      </Drawer>
    </div>
  );
}
