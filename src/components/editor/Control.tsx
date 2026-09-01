"use client";

import { PARAM_META } from "@/engine/defaults";
import { cautionReason, inertReason } from "@/engine/inert";
import type { CarouselParams } from "@/engine/types";
import { Pill } from "./Pill";
import { RingsControl } from "./RingsControl";
import { Slider } from "./Slider";

export interface ControlProps {
  name: keyof CarouselParams;
  params: CarouselParams;
  onChange: (patch: Partial<CarouselParams>) => void;
  /** Reset target for a double-click — the current style's value, not the global default. */
  baseline: CarouselParams;
  /** How many pictures there are. A new ring is sized against the shape they make. */
  cards: number;
  /** Phones get the panel to look at, not to use. */
  disabled?: boolean;
}

const ON_OFF = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
];

/**
 * One parameter, drawn as whatever its metadata says it is.
 *
 * The editor generates itself from PARAM_META, so a parameter added to the
 * engine arrives here with a control already attached and the two cannot fall
 * out of step. This file decides only which of the three shapes it takes.
 */
export function Control({ name, params, onChange, baseline, cards, disabled }: ControlProps) {
  const meta = PARAM_META[name];
  const reason = inertReason(name, params);
  // A caution reads the same as an inert reason, but the control stays live and
  // full strength: it is doing its job, it just cannot finish it here.
  const note = reason ?? cautionReason(name, params);
  const off = disabled || reason !== null;
  const id = `cg-${name}`;

  const body = (() => {
    if (meta.kind === "number") {
      return (
        <Slider
          id={id}
          label={meta.label}
          value={params[name] as number}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          unit={meta.unit}
          centred={meta.centred}
          baseline={baseline[name] as number}
          disabled={off}
          onChange={(value) => onChange({ [name]: value })}
        />
      );
    }

    if (meta.kind === "boolean") {
      return (
        <div className="flex min-h-[30px] items-center justify-between gap-3">
          <span className="text-[12.5px] leading-none text-cg-text">{meta.label}</span>
          <div className="w-[96px] shrink-0">
            <Pill
              label={meta.label}
              options={ON_OFF}
              value={(params[name] as boolean) ? "on" : "off"}
              disabled={off}
              onChange={(next) => onChange({ [name]: next === "on" })}
            />
          </div>
        </div>
      );
    }

    // The only place the pill's strings and the engine's numbers disagree, and
    // it is contained here rather than pushed into the pill.
    if (meta.kind === "segment") {
      return (
        <div className="flex min-h-[30px] items-center justify-between gap-3">
          <span className="text-[12.5px] leading-none text-cg-text">{meta.label}</span>
          <div className="w-[96px] shrink-0">
            <Pill
              label={meta.label}
              options={meta.options}
              value={String(params[name])}
              disabled={off}
              onChange={(next) => onChange({ [name]: Number(next) })}
            />
          </div>
        </div>
      );
    }

    if (meta.kind === "enum") {
      return (
        <div className="space-y-1.5">
          <span className="block text-[12.5px] leading-none text-cg-text">{meta.label}</span>
          <Pill
            label={meta.label}
            options={meta.options}
            value={params[name] as string}
            disabled={off}
            onChange={(next) => onChange({ [name]: next })}
          />
        </div>
      );
    }

    return <RingsControl params={params} onChange={onChange} cards={cards} disabled={disabled} />;
  })();

  // Faded hard, on purpose: at 70% the row still looked live enough that Danny
  // tried to drag one. A control that does nothing should look like it does
  // nothing. WCAG exempts inactive components from the contrast floor for
  // exactly this reason — but only the *component*.
  //
  // So the reason sits outside the fade and at full strength. It is the one
  // thing in the row worth reading when the control is off, and fading the
  // explanation along with the thing it explains had it at 3.4:1, which is how
  // "Autoplay is off." became invisible.
  return (
    <div className="px-3.5 py-1.5">
      <div className={reason ? "opacity-40" : undefined}>{body}</div>
      {note ? (
        <p className="mt-1.5 px-0.5 text-[10.5px] leading-snug text-cg-muted">{note}</p>
      ) : meta.hint ? (
        // The hint gives way to the note. A control that is doing nothing has
        // one thing worth saying, and it is not what the control would do.
        <p className="mt-1.5 px-0.5 text-[10.5px] leading-snug text-cg-faint">{meta.hint}</p>
      ) : null}
    </div>
  );
}
