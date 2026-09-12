// docs/site.md sections 20 and 22.2. Axe pass over every ordinary page
// in the published document in both colour schemes. axe-core's built
// script is injected into the page and executed against the whole
// document; any violation fails the spec.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test, expect } from "@playwright/test";
import {
  assertDevApi,
  fetchCdnSnapshot,
  getAdminSnapshot,
  goto,
} from "../harness";

type PublishedPage = { slug: string; role: string };

const here = dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(
  resolve(here, "../../../node_modules/axe-core/axe.min.js"),
  "utf8",
);

type AxeResults = {
  violations: { id: string; help: string; nodes: unknown[] }[];
};

async function runAxe(page: import("@playwright/test").Page): Promise<AxeResults> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<AxeResults> } }).axe;
    return axe.run(document, {
      resultTypes: ["violations"],
      // Some rules require full layout the preview site can produce; keep
      // them enabled here (unlike the jsdom unit test, which cannot).
      rules: {},
    });
  });
}

function report(results: AxeResults): string {
  return results.violations
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
    .join("\n");
}

test.beforeAll(async () => {
  assertDevApi();
});

for (const scheme of ["light", "dark"] as const) {
  test(`ordinary pages have no axe violations in ${scheme} scheme`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme });
    await context.addInitScript((s: string) => {
      try {
        window.localStorage.setItem("wmsfo.theme", s);
      } catch {
        // ignore
      }
    }, scheme);
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
        await expect(page.locator("main#main")).toBeVisible({ timeout: 15_000 });
        const results = await runAxe(page);
        expect(results.violations, `${p.slug}: ${report(results)}`).toEqual([]);
      }
    } finally {
      await context.close();
    }
  });
}
