import { defineConfig } from "@playwright/test";

/**
 * Visual baselines for the twelve.
 *
 * The unit tests confirm the numbers; only a picture catches "a geometry change
 * quietly ruined style number seven". Chromium only and one device scale — this
 * is a regression net, not a cross-browser matrix, and the browsers that
 * composite 3D differently get looked at by a person in Task 9.2.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SHOOT_URL ?? "http://localhost:3000",
    deviceScaleFactor: 1,
  },
  expect: {
    toHaveScreenshot: {
      // Font rasterisation and the odd sub-pixel differ between machines; a
      // geometry change moves far more than this.
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },
  webServer: {
    command: "pnpm dev",
    url: process.env.SHOOT_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
