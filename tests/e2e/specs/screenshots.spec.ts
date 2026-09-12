// docs/site.md section 22.2. Screenshot baselines for every ordinary
// page (role "none") and every home state (planned, scheduled, live,
// ended, cancelled, no_event) in both colour schemes at 1280 and 400
// pixels wide. Home states are driven through the admin API on the
// dedicated dev walk event, the same lever the status walk uses; a
// hooked `matchMedia` sets the initial scheme before first paint so the
// baseline matches the toggle-driven scheme.

import { test, expect } from "@playwright/test";
import {
  assertDevApi,
  fetchCdnSnapshot,
  getAdminSnapshot,
  goto,
  listEvents,
  setCurrentEvent,
  setEventStatus,
  waitForState,
  type EventStatusId,
} from "../harness";

type PublishedPage = {
  slug: string;
  role: string;
};

const SCHEMES: ("light" | "dark")[] = ["light", "dark"];
const WIDTHS = [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "phone-400", width: 400, height: 800 },
];
const HOME_STATES: { name: string; statusId: EventStatusId | null }[] = [
  { name: "no_event", statusId: null },
  { name: "planned", statusId: 1 },
  { name: "scheduled", statusId: 2 },
  { name: "live", statusId: 3 },
  { name: "ended", statusId: 4 },
  { name: "cancelled", statusId: 5 },
];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  assertDevApi();
});

async function primeScheme(context: import("@playwright/test").BrowserContext, scheme: "light" | "dark"): Promise<void> {
  // Store the choice before the app boots so the inline head script in
  // index.html stamps `data-theme` to `scheme` before first paint.
  await context.addInitScript((s: string) => {
    try {
      window.localStorage.setItem("wmsfo.theme", s);
    } catch {
      // ignore
    }
  }, scheme);
}

async function snapMain(page: import("@playwright/test").Page, name: string): Promise<void> {
  const main = page.locator("main#main");
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.02,
  });
}

test.describe("ordinary pages", () => {
  for (const scheme of SCHEMES) {
    for (const size of WIDTHS) {
      test(`published pages in ${scheme} at ${size.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          colorScheme: scheme,
        });
        await primeScheme(context, scheme);
        const page = await context.newPage();
        try {
          const adminSnap = await getAdminSnapshot();
          const snap = (await fetchCdnSnapshot(adminSnap.url)) as {
            content?: { pages?: PublishedPage[] };
          };
          const pages = (snap.content?.pages ?? []).filter((p) => p.role === "none");
          expect(pages.length).toBeGreaterThan(0);
          for (const p of pages) {
            await goto(page, `/${p.slug}`);
            await snapMain(page, `page-${p.slug}-${scheme}-${size.name}.png`);
          }
        } finally {
          await context.close();
        }
      });
    }
  }
});

test.describe("home states", () => {
  for (const scheme of SCHEMES) {
    for (const size of WIDTHS) {
      test(`home states in ${scheme} at ${size.name}`, async ({ browser }) => {
        test.setTimeout(300_000);
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          colorScheme: scheme,
        });
        await primeScheme(context, scheme);
        const page = await context.newPage();
        await page.addLocatorHandler(page.getByRole("button", { name: /i understand/i }), async (button) => {
          await button.click();
        });
        const events = await listEvents();
        const walk = events.find((e) => e.year === 2100 && e.name === "E2E walk");
        if (!walk) throw new Error("Dedicated E2E walk event (year 2100) is missing");
        const previousCurrent = events.find((e) => e.isCurrent && e.id !== walk.id) ?? null;
        await setCurrentEvent(walk.id);
        try {
          for (const state of HOME_STATES) {
            if (state.statusId !== null) {
              await setEventStatus(walk.id, state.statusId);
            }
            await goto(page, "/");
            if (state.statusId !== null) {
              await waitForState(
                page,
                (s) => (s?.live?.eventStatusId ?? null) === state.statusId,
                20_000,
              );
            }
            await snapMain(page, `home-${state.name}-${scheme}-${size.name}.png`);
          }
        } finally {
          try {
            await setEventStatus(walk.id, 4);
          } catch {
            // ignore
          }
          if (previousCurrent) {
            try {
              await setCurrentEvent(previousCurrent.id);
            } catch {
              // ignore
            }
          }
          await context.close();
        }
      });
    }
  }
});
