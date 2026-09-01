"use client";

import { PARAM_META } from "@/engine/defaults";
import { cardsPerRow, defaultRingScale } from "@/engine/layout";
import type { CarouselParams, RingSpec } from "@/engine/types";
import { Pill } from "./Pill";
import { Slider } from "./Slider";

/** Cards a second a ring can drift, either way. */
const DRIFT_RANGE = 1.5;

/**
 * How close to the middle counts as stopped.
 *
 * A ring turns one way below zero and the other way above it, so "not turning"
 * is a single point in the middle of a slider three units wide — about one pixel
 * of track. Danny, having nudged one: "I couldn't get it back to zero where it
 * wasn't moving at all even though I was trying to find the middle point." So
 * the middle is a detent a few pixels wide that the thumb drops into. Nothing is
 * lost: the slowest speed this rules out is a twentieth of a card a second,
 * which is four minutes for one turn of a twelve-card ring.
 */
const DRIFT_DETENT = 0.06;

const settled = (drift: number) => (Math.abs(drift) < DRIFT_DETENT ? 0 : drift);

/** Which way each arrow key takes a slider. */
const ARROW_STEP: Record<string, number | undefined> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

/** Which way a ring is turning, and how fast — or that it is not. */
function driftReadout(drift: number): string {
  if (drift === 0) return "still";
  return `${Math.abs(drift).toFixed(2)} ${drift < 0 ? "←" : "→"}`;
}

const COUNTS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

export interface RingsControlProps {
  params: CarouselParams;
  onChange: (patch: Partial<CarouselParams>) => void;
  /** How many pictures there are, so a new ring can be sized against the shape. */
  cards: number;
  disabled?: boolean;
}

/**
 * Rings: how many, and for each one beyond the first, how much wider it sits
 * and which way it turns. The first ring is the arrangement itself.
 */
export function RingsControl({ params, onChange, cards, disabled }: RingsControlProps) {
  const meta = PARAM_META.rings;
  const rings = params.rings.length > 0 ? params.rings : [{ scale: 1, drift: 0 }];
  const setRings = (next: RingSpec[]) => onChange({ rings: next });
  // Sized against the arrangement rather than a fixed multiple: the same number
  // means a gentle step out on a closed ring and a card the width of the frame
  // on a shallow one. See defaultRingScale.
  const perRow = cardsPerRow(params, cards);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] leading-none text-cg-text">{meta.label}</span>
        <div className="w-[96px] shrink-0">
          <Pill
            label="Rings"
            options={COUNTS}
            value={String(rings.length)}
            disabled={disabled}
            onChange={(next) =>
              setRings(
                Array.from(
                  { length: Number(next) },
                  (_, i) => rings[i] ?? { scale: defaultRingScale(params, i, perRow), drift: 0 },
                ),
              )
            }
          />
        </div>
      </div>

      {rings.map((ring, i) => {
        const set = (patch: Partial<RingSpec>) =>
          setRings(rings.map((r, j) => (j === i ? { ...r, ...patch } : r)));

        return (
          <div key={i} className="space-y-1.5 border-l border-cg-line pl-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-cg-faint">
                Ring {i + 1}
              </span>
              {/* Ring one *is* the arrangement, so its size is 1 by definition.
                  Said rather than offered as a slider that can never move. */}
              {i === 0 ? (
                <span className="font-cg-mono text-[10.5px] tabular-nums text-cg-faint">
                  1.00× · the base
                </span>
              ) : null}
            </div>

            {i > 0 ? (
              <Slider
                id={`cg-rings-${i}-size`}
                label="Size"
                ariaLabel={`Ring ${i + 1} size`}
                value={ring.scale}
                min={0.4}
                max={3}
                step={0.05}
                unit="×"
                baseline={defaultRingScale(params, i, perRow)}
                disabled={disabled}
                onChange={(scale) => set({ scale })}
              />
            ) : null}

            <Slider
              id={`cg-rings-${i}-drift`}
              label="Turn"
              ariaLabel={`Ring ${i + 1} turn`}
              value={ring.drift}
              min={-DRIFT_RANGE}
              max={DRIFT_RANGE}
              step={0.01}
              centred
              baseline={0}
              disabled={disabled}
              readout={driftReadout}
              onChange={(drift) => set({ drift: settled(drift) })}
              onKeyDown={(event) => {
                // An arrow key moves one step, and one step is inside the
                // detent, so from a stop the thumb would snap straight back and
                // the keyboard could never start a ring turning. From zero the
                // first press goes to the slowest speed that is not a stop.
                const way = ARROW_STEP[event.key];
                if (way === undefined || ring.drift !== 0) return;
                event.preventDefault();
                set({ drift: way * DRIFT_DETENT });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
