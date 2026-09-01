import { createCarousel } from "./controller";

/**
 * The bundle's entry point: one function, on one global.
 *
 * This exists so the copied snippet has something to call that does not look
 * like a module system. Everything else in `src/engine/` is imported from here,
 * which also means esbuild's input list for this file is exactly the set of
 * sources the committed bundle has to stay in step with.
 */
export { createCarousel };
