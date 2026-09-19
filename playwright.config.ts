import { defineConfig, devices } from "@playwright/test";

// docs/site.md section 22.2. E2E_BASE_URL is the preview site; the harness under
// tests/e2e/harness refuses to run against anything but the dev stack. The
// status walk runs serially in one worker; every other spec is parallel.
// Global setup mints one admin ID token per run into `E2E_ADMIN_ID_TOKEN`
// so every worker inherits the same token (TOTP codes are single use).
// Against a deployed host the config caps concurrency at two workers with
// `fullyParallel: false`, because the site sits behind a bot checkpoint
// that answers 403 with a challenge when one address opens many pages at
// once.
const baseUrl = process.env.E2E_BASE_URL ?? "";
const isDeployed = baseUrl !== "" && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(baseUrl);

export default defineConfig({
  testDir: "tests/e2e/specs",
  globalSetup: "./tests/e2e/globalSetup.ts",
  fullyParallel: isDeployed ? false : true,
  workers: isDeployed ? 2 : process.env.CI ? 1 : undefined,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Screenshot baselines are committed side-by-side with the specs at
  // tests/e2e/baselines/; the screenshots spec drives both colour schemes
  // and two viewport widths against these files (site.md 22.2).
  snapshotDir: "tests/e2e/baselines",
  snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    // The site's CSP has no 'unsafe-eval'; the harness evaluates scripts in the
    // page, so the test context bypasses it. The CSP itself is asserted by its
    // own spec.
    bypassCSP: true,
  },
  projects: [
    {
      name: "desktop",
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "phone",
      testMatch: /pages\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
