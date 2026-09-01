import { CarouselPreview } from "@/components/CarouselPreview";
import { IMAGES } from "@/data/images";
import { presetBySlug } from "@/engine/presets";
import type { CarouselParams } from "@/engine/types";

export const metadata = {
  title: "Depth on flat styles",
  robots: { index: false, follow: false },
};

const flatFan = presetBySlug("flat-fan")!;
const peekStack = presetBySlug("peek-stack")!;

/** Same style, same everything, one dial moved — laid out so the eye can compare. */
const PANELS: { label: string; note: string; cards: number; params: Partial<CarouselParams> }[] = [
  {
    label: "Flat fan · Depth 0",
    note: "the slider at one end",
    cards: flatFan.cards,
    params: { ...flatFan.params, depth: 0, spacing: 150, cardWidth: 130 },
  },
  {
    label: "Flat fan · Depth 3 (maximum)",
    note: "the slider at the other end — the same picture",
    cards: flatFan.cards,
    params: { ...flatFan.params, depth: 3, spacing: 150, cardWidth: 130 },
  },
  {
    label: "Peek stack · Curve 0, Depth 3",
    note: "a genuinely flat deck: nothing separates the cards",
    cards: peekStack.cards,
    params: { ...peekStack.params, curve: 0, depth: 3, cardWidth: 190, spacing: 28 },
  },
  {
    label: "Peek stack · Curve 0.45, Depth 3 (ships)",
    note: "curve and depth together — this is why it needs both",
    cards: peekStack.cards,
    params: { ...peekStack.params, cardWidth: 190, spacing: 28 },
  },
];

export default function DepthCheckPage() {
  return (
    <main data-shot="depth-check" className="w-[1100px] bg-white p-5 text-zinc-900">
      <h1 className="mb-1 text-base font-semibold">Does the Depth slider do anything on a flat style?</h1>
      <p className="mb-4 max-w-[70ch] text-xs leading-relaxed text-zinc-600">
        Depth deepens the curve. Where there is no curve there is nothing for it to deepen, so on the
        genuinely flat styles the slider moves and the picture does not.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {PANELS.map((panel) => (
          <section key={panel.label} className="overflow-hidden rounded-lg border border-zinc-200">
            <div className="border-b border-zinc-200 px-3 py-2">
              <h2 className="text-xs font-semibold">{panel.label}</h2>
              <p className="text-[11px] text-zinc-500">{panel.note}</p>
            </div>
            <div className="bg-[#f4f4f5]">
              <CarouselPreview
                items={IMAGES.slice(0, panel.cards)}
                params={{ ...panel.params, arrows: false }}
                style={{ width: "100%", height: "300px" }}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
