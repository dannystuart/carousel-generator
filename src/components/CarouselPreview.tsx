"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { createCarousel } from "@/engine/controller";
import type { CarouselInstance, CarouselItem } from "@/engine/controller";
import type { CarouselParams } from "@/engine/types";

export interface CarouselPreviewProps {
  items: CarouselItem[];
  params: Partial<CarouselParams>;
  className?: string;
  style?: CSSProperties;
  /** Handed the live instance once it exists, for arrows or a preset row outside it. */
  onReady?: (instance: CarouselInstance) => void;
}

/**
 * Mounts the engine into a div and gets out of the way.
 *
 * Deliberately thin: React owns the element, the engine owns everything inside
 * it. Nothing about the cards is expressed in JSX, because the same controller
 * has to run inside the snippet people copy out — a React implementation here
 * would be a second implementation of the same maths, drifting from the first.
 */
export function CarouselPreview({ items, params, className, style, onReady }: CarouselPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<CarouselInstance | null>(null);

  // The latest props, for the effects to read. The editor re-renders on every
  // slider move, and putting `params` in the mount effect's dependencies would
  // rebuild the DOM and jump back to the first card each time.
  const latest = useRef({ items, params, onReady });

  // Declared first on purpose: React runs every cleanup for a commit and then
  // every effect, both in declaration order, so this is always current by the
  // time the mount effect below reads it — including on a genuine remount.
  useLayoutEffect(() => {
    latest.current = { items, params, onReady };
  }, [items, params, onReady]);

  // A fresh array holding the same pictures is not a reason to remount.
  const signature = items.map((item) => item.src).join("|");

  // Where the visitor was, carried across a rebuild. Without it every style
  // change snapped back to the first card — you were looking at one picture
  // and suddenly a different one was centred. The phase rather than the
  // index, so a style that turns on its own hands over mid-turn instead of
  // rewinding to wherever its drift began.
  const carried = useRef(0);

  // A layout effect, not a passive one: the editor measures a newly picked
  // style's arrangement inside the click that picked it, and the cards it
  // measures have to be that style's own. Passive timing rebuilt them some
  // time after the click; this rebuilds them before anything else runs.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const instance = createCarousel(host, {
      items: latest.current.items,
      params: latest.current.params,
      startAt: carried.current,
    });
    instanceRef.current = instance;
    latest.current.onReady?.(instance);

    return () => {
      carried.current = instance.phase();
      instanceRef.current = null;
      instance.destroy();
    };
  }, [signature]);

  useEffect(() => {
    instanceRef.current?.setParams(params);
  }, [params]);

  return <div ref={hostRef} className={className} style={style} />;
}
