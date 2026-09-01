import { notFound } from "next/navigation";
import { CarouselPreview } from "@/components/CarouselPreview";
import { PREVIEW_STAGE } from "@/components/previewStage";
import { IMAGES } from "@/data/images";
import { DEFAULT_PARAMS, PARAM_META } from "@/engine/defaults";
import { PRESETS, presetBySlug } from "@/engine/presets";
import type { CarouselParams } from "@/engine/types";

export const metadata = {
  title: "Style tuning",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return PRESETS.map((preset) => ({ slug: preset.slug }));
}

/**
 * One style, alone, at the size the editor's preview will be — which is the
 * only size worth tuning against. The catalogue grid judged sixteen candidates
 * side by side in a 660×520 cell; a style that reads well small can be a
 * different animal at full size, so the twelve get re-tuned here.
 *
 * The clipping lives on this wrapper and nowhere below it: `overflow` on either
 * .cg-root or .cg-stage flattens `preserve-3d` and the whole arrangement
 * collapses into a flat overlap. See docs/web-build-gotchas.md.
 */
/**
 * `?set=cardFacing:-1;spacing:120` — try a value without editing the preset.
 * Dev-only sugar for the tuning loop, and for shooting an A/B of one dial.
 */
function overrides(set: string | undefined): Partial<CarouselParams> {
  if (!set) return {};
  const out: Record<string, unknown> = {};
  for (const pair of set.split(";")) {
    const [key, raw] = pair.split(":");
    if (!key || raw === undefined || !(key in PARAM_META)) continue;
    out[key] = raw === "true" ? true : raw === "false" ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  return out as Partial<CarouselParams>;
}

export default async function StylePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ set?: string; static?: string }>;
}) {
  const { slug } = await params;
  const preset = presetBySlug(slug);
  if (!preset) notFound();

  const query = await searchParams;
  const tweaks = overrides(query.set);
  // `?static=1` parks it: nothing drifts, nothing plays, nothing eases. Two of
  // the twelve turn forever on their own, so without this a visual baseline
  // would be a photograph of a moment and would disagree with itself.
  const frozen: Partial<CarouselParams> = query.static
    ? { rings: (preset.params.rings ?? DEFAULT_PARAMS.rings).map((r) => ({ ...r, drift: 0 })), autoplay: false, speed: 0 }
    : {};
  const applied = { ...preset.params, ...tweaks, ...frozen };

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 py-6 text-zinc-900 dark:text-zinc-100">
      <header className="flex w-full max-w-[1040px] items-baseline justify-between px-1">
        <h1 className="text-sm font-semibold">{preset.name}</h1>
        <p className="text-xs text-zinc-500">
          {preset.cards} cards · {preset.reference} · {PREVIEW_STAGE.width}×{PREVIEW_STAGE.height}
          {Object.keys(tweaks).length > 0 ? ` · overridden: ${Object.entries(tweaks).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}
        </p>
      </header>

      <div
        data-shot={preset.slug}
        // The text colour matters as much as the background: the carousel's
        // arrows and dots are drawn in currentColor, so on a light backdrop
        // without it they inherit the app's near-white ink and vanish.
        className={`overflow-hidden rounded-lg ${
          preset.background === "dark"
            ? "bg-[#08080a] text-[#e9e7e2]"
            : "bg-[#f4f4f5] text-[#08090b]"
        }`}
        style={{ width: PREVIEW_STAGE.width, height: PREVIEW_STAGE.height }}
      >
        <CarouselPreview
          items={IMAGES.slice(0, preset.cards)}
          params={applied}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <p className="max-w-[1040px] px-1 text-xs text-zinc-500">{preset.oneLiner}</p>
    </main>
  );
}
