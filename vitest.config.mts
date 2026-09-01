import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // e2e/ is Playwright's, and its test() is not this test(). `pnpm test` is
    // the unit suite; `pnpm test:visual` is the pictures.
    //
    // Not vitest's default list plus e2e: that list excludes **/dist/**, and the
    // engine's committed bundle lives in src/engine/dist — copying it silently
    // dropped the four tests that keep that bundle in step with its sources.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
