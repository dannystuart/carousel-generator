import { CarouselPreview } from "@/components/CarouselPreview";
import { CANDIDATES } from "@/data/candidates";
import { IMAGES } from "@/data/images";

export const metadata = {
  title: "Candidate catalogue",
  robots: { index: false, follow: false },
};

/**
 * A working page, not a screenshot sheet: sixteen live carousels running the
 * real engine, so the ten can be chosen on how they move rather than how they
 * photograph. Not linked from anywhere and not indexed.
 */
const RANK = { in: 0, pending: 1, out: 2 } as const;
const ORDERED = [...CANDIDATES].sort((a, b) => RANK[a.status] - RANK[b.status]);

const STATUS_LABEL = { in: "chosen", pending: "undecided", out: "dropped" } as const;
const STATUS_STYLE = {
  in: "rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400",
  pending: "rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400",
  out: "rounded-full bg-zinc-500/15 px-2 py-0.5 font-medium text-zinc-500",
} as const;

export default function CataloguePage() {
  return (
    <main className="mx-auto max-w-[1500px] px-6 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Candidate catalogue</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Positions on the same set of dials. Drag one, tap a card to bring it to the centre,
          or use the arrow keys once it has focus. Chosen ones first, then the undecided,
          then the ones that have been dropped.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {ORDERED.map((candidate, index) => (
          <section
            key={candidate.slug}
            className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-baseline justify-between gap-4 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold">
                <span className="mr-2 tabular-nums text-zinc-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {candidate.name}
              </h2>
              <p className="flex items-center gap-3 text-xs text-zinc-500">
                <span>
                  {candidate.cards} cards · {candidate.reference}
                </span>
                <span className={STATUS_STYLE[candidate.status]}>{STATUS_LABEL[candidate.status]}</span>
              </p>
            </div>

            {/* Fixed, not theme-aware: these are being judged against reference
                shots, most of which are on white. */}
            <div
              data-shot={candidate.slug}
              className={
                candidate.background === "dark"
                  ? "bg-[#08080a] text-[#e9e7e2]"
                  : "bg-[#f4f4f5] text-[#08090b]"
              }
            >
              <CarouselPreview
                items={IMAGES.slice(0, candidate.cards)}
                params={candidate.params}
                style={{ height: "520px" }}
              />
            </div>

            <p className="border-t border-zinc-200 px-5 py-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {candidate.oneLiner}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
