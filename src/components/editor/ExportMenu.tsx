"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CarouselItem } from "@/engine/controller";
import { toHtml } from "@/engine/export/toHtml";
import { toPrompt } from "@/engine/export/toPrompt";
import type { Preset } from "@/engine/presets";
import type { CarouselParams } from "@/engine/types";
import { copy } from "./clipboard";

export interface ExportMenuProps {
  params: CarouselParams;
  items: CarouselItem[];
  preset: Preset;
  /** False once a slider has moved, so the prompt stops claiming a style name. */
  onPreset: boolean;
}

type RowId = "code" | "prompt";

/**
 * Shut and open are the resting states. The two -ing ones exist so the exit gets
 * to play: an element dropped the instant it is asked to close has no chance to
 * animate out, and a menu that appears gently and vanishes instantly reads as a
 * bug rather than as a menu.
 */
type Phase = "shut" | "opening" | "open" | "closing";

const KB = (text: string) => `${(new Blob([text]).size / 1024).toFixed(1)}KB`;

/** How long the confirmation stays up before the row goes back to normal. */
const CONFIRM_MS = 1400;

const CodeGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M5.8 4.4 2.4 8l3.4 3.6M10.2 4.4 13.6 8l-3.4 3.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PromptGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M13.4 8.4c0 2.4-2.4 4.3-5.4 4.3a6.7 6.7 0 0 1-1.6-.2l-3 1.1.9-2.3a4 4 0 0 1-1.7-3c0-2.4 2.4-4.3 5.4-4.3s5.4 1.9 5.4 4.4Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const Tick = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path
      d="m3.4 8.4 3 3 6.2-6.6"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The two things you leave with.
 *
 * What it copies is exactly what the preview is running — the same engine, not a
 * description of it. It says so by being one tap: there is no panel of code to
 * read and then mistrust, because the thing on screen *is* the thing that lands
 * in the clipboard.
 */
export function ExportMenu({ params, items, preset, onPreset }: ExportMenuProps) {
  const [phase, setPhase] = useState<Phase>("shut");
  const [done, setDone] = useState<RowId | null>(null);
  const [failed, setFailed] = useState<RowId | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const mounted = phase !== "shut";
  const open = phase === "opening" || phase === "open";

  // Building twenty kilobytes of string on every frame of a slider drag is work
  // nobody is looking at. React can run it behind the preview instead.
  const settled = useDeferredValue(params);

  const code = useMemo(
    () => toHtml({ params: settled, items, id: `${preset.slug}-carousel` }),
    [settled, items, preset.slug],
  );
  const prompt = useMemo(
    () =>
      toPrompt({
        params: settled,
        cards: preset.cards,
        styleName: onPreset ? preset.name : undefined,
      }),
    [settled, preset.cards, preset.name, onPreset],
  );

  const rows = useMemo(
    () => [
      { id: "code" as RowId, label: "Code", text: code, Glyph: CodeGlyph },
      { id: "prompt" as RowId, label: "Prompt", text: prompt, Glyph: PromptGlyph },
    ],
    [code, prompt],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const shut = useCallback(() => {
    setPhase((current) => (current === "shut" || current === "closing" ? current : "closing"));
  }, []);

  /**
   * A backstop for the phase change that `animationend` normally makes.
   *
   * The event is the accurate signal and stays the primary one, but it is not a
   * guaranteed one: an environment with animations suppressed never fires it,
   * and a menu whose exit depends on an event that never arrives is a menu stuck
   * open. Generous enough that it only ever lands second.
   */
  useEffect(() => {
    if (phase === "shut" || phase === "open") return;
    const settleAt = phase === "opening" ? 400 : 260;
    const timer = setTimeout(() => {
      setPhase((current) =>
        current === "opening" ? "open" : current === "closing" ? "shut" : current,
      );
    }, settleAt);
    return () => clearTimeout(timer);
  }, [phase]);

  // Escape belongs to the document rather than to the menu: focus may be on the
  // trigger, on a row, or nowhere at all after a click.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      shut();
      trigger.current?.focus();
    };
    const onOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) shut();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, shut]);

  const onPick = async (row: (typeof rows)[number]) => {
    clearTimers();
    setFailed(null);
    setDone(null);

    const ok = await copy(row.text);
    if (ok) setDone(row.id);
    else setFailed(row.id);

    timers.current.push(
      setTimeout(() => {
        setDone(null);
        setFailed(null);
      }, CONFIRM_MS),
      // Just after the row has gone back to normal, so the menu is never seen
      // closing on a green tick — the confirmation gets to finish first.
      setTimeout(shut, CONFIRM_MS + 200),
    );
  };

  return (
    <div className="relative" ref={root}>
      {mounted ? (
        <div
          role="menu"
          aria-label="Export"
          data-phase={phase}
          className="cg-export__menu"
          onAnimationEnd={(event) => {
            // The rows animate too, and their events bubble through here.
            if (event.target !== event.currentTarget) return;
            setPhase((current) =>
              current === "opening" ? "open" : current === "closing" ? "shut" : current,
            );
          }}
        >
          {rows.map((row, i) => {
            const confirmed = done === row.id;
            const missed = failed === row.id;
            return (
              <button
                key={row.id}
                type="button"
                role="menuitem"
                onClick={() => onPick(row)}
                style={{ ["--i" as string]: i }}
                data-taken={confirmed || undefined}
                className="cg-export__row"
              >
                {/* A single sweep of light crossing the row on the way past.
                    The tick alone says "done" without saying anything happened;
                    something travelling says the thing was taken. */}
                <span className="cg-export__sweep" aria-hidden />

                <span className="cg-export__glyph" data-done={confirmed || undefined}>
                  <span className="cg-export__glyph-off">
                    <row.Glyph />
                  </span>
                  <span className="cg-export__glyph-on">
                    <Tick />
                  </span>
                </span>

                <span className="min-w-0 flex-1 truncate text-left text-[12.5px] leading-none text-cg-text">
                  {confirmed ? `${row.label} Copied` : missed ? "Press ⌘C" : row.label}
                </span>

                {/* On the same line as the name it belongs to, rather than
                    tucked underneath it in a size nobody can read. */}
                <span className="shrink-0 font-cg-mono text-[10.5px] leading-none text-cg-muted">
                  {KB(row.text)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          clearTimers();
          setDone(null);
          setFailed(null);
          if (open) shut();
          else setPhase("opening");
        }}
        className="cg-export__trigger"
      >
        Export
        <svg
          viewBox="0 0 16 16"
          width="10"
          height="10"
          fill="none"
          aria-hidden
          className={`transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M4 9.8 8 6l4 3.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
