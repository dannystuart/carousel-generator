"use client";

import { useEffect } from "react";

/**
 * A box the size of the window, with the page behind it held still.
 *
 * The editor itself fills whatever container it is given and never touches the
 * document — one contract, so the same component can be a whole screen here and
 * a figure in the middle of a page somewhere else. This is the caller that asks
 * for the whole screen, and the only place the scroll lock lives.
 *
 * The lock is a class this component adds and removes rather than a rule in
 * globals.css, because other routes sit under the same root layout and still
 * need to scroll.
 */
export function FullScreenStage({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("cg-locked");
    return () => root.classList.remove("cg-locked");
  }, []);

  return (
    <main id="main-content" className="fixed inset-0 overflow-hidden">
      {children}
    </main>
  );
}
