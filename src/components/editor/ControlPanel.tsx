"use client";

import { useMemo, useState } from "react";
import { PARAM_GROUPS, PARAM_META } from "@/engine/defaults";
import type { Group } from "@/engine/defaults";
import type { CarouselParams } from "@/engine/types";
import { Control } from "./Control";
import { editedKeys } from "./edited";

export interface ControlPanelProps {
  params: CarouselParams;
  baseline: CarouselParams;
  onChange: (patch: Partial<CarouselParams>) => void;
  /** How many pictures there are, so a new ring can be sized against the shape. */
  cards: number;
  /** What is typed in the search box. Empty means the folds behave normally. */
  query?: string;
  /** Phones see the whole panel, greyed and inert — see the spec's §10. */
  disabled?: boolean;
}

const ALL_KEYS = Object.keys(PARAM_META) as (keyof CarouselParams)[];

export function ControlPanel({
  params,
  baseline,
  onChange,
  cards,
  query = "",
  disabled,
}: ControlPanelProps) {
  const [open, setOpen] = useState<Group | null>("camera");

  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    return new Set(ALL_KEYS.filter((key) => PARAM_META[key].label.toLowerCase().includes(needle)));
  }, [needle]);

  const edited = useMemo(() => new Set(editedKeys(params, baseline)), [params, baseline]);

  const keysIn = (group: Group) =>
    ALL_KEYS.filter((key) => PARAM_META[key].group === group && (!matches || matches.has(key)));

  if (matches && matches.size === 0) {
    return <p className="px-4 py-6 text-[12px] text-cg-faint">No controls match “{query.trim()}”.</p>;
  }

  return (
    <div className="pb-2">
      {PARAM_GROUPS.map((group) => {
        const keys = keysIn(group.id);
        if (keys.length === 0) return null;

        // A search shows what it found. Hiding a match behind a fold would make
        // the box a way of learning that something exists and nothing more.
        const isOpen = !group.folds || Boolean(matches) || open === group.id;
        const dirty = keys.some((key) => edited.has(key));

        return (
          <section key={group.id} className="border-b border-cg-line/70 last:border-b-0">
            {group.folds ? (
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : group.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60"
                >
                  <span className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-cg-muted">
                    {group.title}
                    {/* An edit inside a folded section is an edit you cannot
                        find. This is the only thing between the visitor and
                        opening all nine folds looking for it. */}
                    {dirty ? (
                      <span
                        data-edited
                        aria-label="edited"
                        className="h-1 w-1 rounded-full bg-cg-text/70"
                      />
                    ) : null}
                  </span>
                  <span
                    aria-hidden
                    className={`font-cg-mono text-[11px] text-cg-faint transition-transform duration-200 motion-reduce:transition-none ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    ›
                  </span>
                </button>
              </h3>
            ) : null}

            {isOpen ? (
              <div className="space-y-1 pb-2.5">
                {keys.map((key) => (
                  <Control
                    key={key}
                    name={key}
                    params={params}
                    baseline={baseline}
                    onChange={onChange}
                    cards={cards}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
