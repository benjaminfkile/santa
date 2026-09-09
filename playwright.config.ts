import { defineConfig, devices } from "@playwright/test";

// docs/site.md section 22.2. E2E_BASE_URL is the preview site; the harness under
// tests/e2e/harness refuses to run against anything but the dev stack. The
// status walk runs serially in one worker; every other spec is parallel.
export default defineConfig({
  testDir: "tests/e2e/specs",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
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
