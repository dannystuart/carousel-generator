import { Editor } from "@/components/editor/Editor";

export const metadata = {
  title: "The editor in a box",
  robots: { index: false, follow: false },
};

/**
 * The editor as a figure on somebody else's page, rather than as the whole
 * screen — which is how it will arrive on vanta.supply's tool page, sitting
 * under a heading with companion copy below it.
 *
 * A dev route, and the reason it exists is that the claim "it fills whatever
 * container you give it" is worth nothing unless something actually gives it a
 * different container. The full-screen route cannot test that: it is the case
 * that always worked. Here it is boxed, scrolled past, and standing next to
 * ordinary page text, which is where a `position: fixed` left over from the
 * old shell would show up immediately.
 *
 * See docs/plans/2026-08-12-vanta-port.md.
 */
export default function EmbeddedCheck() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl">The editor in a box</h1>
      <p className="mt-3 max-w-prose text-cg-muted">
        Everything below the heading is the same component the front page renders full
        screen. The page still scrolls, the header above stays put, and the drawer folds
        into the figure rather than into the window.
      </p>

      {/* The caller supplies the box. 16:9 to match the stage waiting on the
          tool page, and `relative` because the editor pins itself to its
          nearest positioned ancestor. */}
      <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-xl border border-cg-line">
        <Editor />
      </div>

      <p className="mt-10 max-w-prose text-cg-muted">
        Companion copy would live here — what the tool makes, how to get the most from
        it, and where the results work best. It is the whole reason for embedding rather
        than taking the screen: a page with no words on it has nothing to rank.
      </p>
      <div className="h-[60vh]" />
      <p className="text-cg-faint">
        Padding, so the scroll can be tested. If the editor were still pinned to the
        viewport it would be sitting on top of this line.
      </p>
    </main>
  );
}
