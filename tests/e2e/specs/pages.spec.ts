// docs/site.md section 22.2. Parallel page smoke: each ordinary page in
// the published document renders its first section; the route-preview
// page loads the map and draws a polyline; /preview renders the ended
// page while the walk is planned; /alerts/verify and /alerts/unsubscribe
// with invalid tokens render the invalid copy; the CSP meta is present.

import { test, expect } from "@playwright/test";
import {
  assertDevApi,
  deleteContactMessage,
  fetchCdnSnapshot,
  getAdminSnapshot,
  goto,
  listContactMessages,
  mintPreviewToken,
  readCspMeta,
} from "../harness";

type PublishedPage = {
  slug: string;
  role: string;
  sections: { kind: string; data?: { style?: string } }[];
};

test.beforeAll(async () => {
  assertDevApi();
});

test("published pages render their first section", async ({ page }) => {
  const adminSnap = await getAdminSnapshot();
  const snap = (await fetchCdnSnapshot(adminSnap.url)) as { content?: { pages?: PublishedPage[] } };
  const pages = (snap.content?.pages ?? []).filter((p) => p.role === "none");
  expect(pages.length).toBeGreaterThan(0);
  for (const p of pages) {
    await goto(page, `/${p.slug}`);
    await expect(page.locator('main[data-page-role="none"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("main section, main [data-testid^='section-']").first()).toBeVisible();
  }
});

test("a page with a route_preview in viewer style renders the poster and zooms on a wheel event without loading the map chunk", async ({ page }) => {
  const adminSnap = await getAdminSnapshot();
  const snap = (await fetchCdnSnapshot(adminSnap.url)) as { content?: { pages?: PublishedPage[] } };
  const pages = snap.content?.pages ?? [];
  const target = pages.find((p) =>
    p.sections.some((s) => s.kind === "route_preview" && s.data?.style === "viewer"),
  );
  test.skip(target === undefined, "no route_preview in viewer style in the published document");
  if (!target) return;
  // Track every script fetched during the visit; the map chunk (`map-*.js`)
  // must not appear when the viewer renders (site.md 8.5).
  const scripts: string[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if (/\/assets\/map-[^/]+\.js$/.test(url)) scripts.push(url);
  });
  await goto(page, `/${target.slug}`);
  await expect(page.locator('[data-testid="poster-viewer"]')).toBeVisible({ timeout: 20_000 });
  const before = await page.locator('[data-testid="poster-viewer"] img').getAttribute("style");
  await page.locator('[data-testid="poster-viewer"]').dispatchEvent("wheel", { deltaY: -100, clientX: 100, clientY: 100 });
  const after = await page.locator('[data-testid="poster-viewer"] img').getAttribute("style");
  expect(after).not.toBe(before);
  expect(scripts).toEqual([]);
});

test("the header theme toggle flips data-theme and the choice survives a reload", async ({ page }) => {
  await goto(page, "/");
  await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 15_000 });
  const before = await page.evaluate(
    "document.documentElement.getAttribute('data-theme')",
  );
  await page.locator('[data-testid="theme-toggle"]').click();
  const flipped = await page.evaluate(
    "document.documentElement.getAttribute('data-theme')",
  );
  expect(flipped).not.toBe(before);
  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = await page.evaluate(
    "document.documentElement.getAttribute('data-theme')",
  );
  expect(afterReload).toBe(flipped);
});

test("/preview renders the ended page with the preview banner while the walk is planned", async ({ page }) => {
  const minted = await mintPreviewToken("ended");
  await goto(page, `/preview?token=${minted.token}&page=ended`);
  await expect(page.locator('[data-testid="preview-banner"]')).toBeVisible();
  await expect(page.locator('main[data-page-role="ended"]')).toBeVisible({ timeout: 15_000 });
});

test("/alerts/verify with an invalid token renders the invalid copy after one POST", async ({ page }) => {
  const invalid = "wsv_" + "A".repeat(43);
  let posts = 0;
  await page.route("**/subscriptions/verify", (route) => {
    posts += 1;
    void route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "not_found" }) });
  });
  await goto(page, `/alerts/verify?token=${invalid}`);
  await expect(page.locator("body")).toContainText(/expired|not valid/i, { timeout: 10_000 });
  expect(posts).toBe(1);
});

test("/alerts/unsubscribe with an invalid token renders the invalid copy after one POST", async ({ page }) => {
  const invalid = "wsu_" + "A".repeat(43);
  let posts = 0;
  await page.route("**/subscriptions/unsubscribe", (route) => {
    posts += 1;
    void route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "not_found" }) });
  });
  await goto(page, `/alerts/unsubscribe?token=${invalid}`);
  await expect(page.locator("body")).toContainText(/not valid/i, { timeout: 10_000 });
  expect(posts).toBe(1);
});

test("the contact form posts a message that the admin endpoints then delete", async ({ page }) => {
  const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());
  const marker = `E2E-${runId}`;
  const before = await listContactMessages();
  const beforeIds = new Set(before.map((m) => m.id));

  const adminSnap = await getAdminSnapshot();
  const snap = (await fetchCdnSnapshot(adminSnap.url)) as { content?: { pages?: PublishedPage[] } };
  const contactPage = (snap.content?.pages ?? []).find((p) =>
    p.sections.some((s) => s.kind === "contact_form"),
  );
  test.skip(contactPage === undefined, "no contact_form section in the published document");
  if (!contactPage) return;

  await goto(page, `/${contactPage.slug}`);
  await page.locator('[data-testid="contact-name"]').fill("E2E");
  await page.locator('[data-testid="contact-email"]').fill(`e2e+${runId}@example.com`);
  await page.locator('[data-testid="contact-message"]').fill(`hello ${marker}`);
  await page.locator('[data-testid="contact-submit"]').click();
  await expect(page.locator('[data-testid="contact-success"]')).toBeVisible({ timeout: 15_000 });

  const after = await listContactMessages();
  const created = after.find((m) => m.body.includes(marker) && !beforeIds.has(m.id));
  expect(created).toBeDefined();
  if (created) await deleteContactMessage(created.id);
});

test("/nope renders the 404 page", async ({ page }) => {
  await goto(page, "/nope");
  await expect(page.locator("body")).toContainText(/not found|404/i);
});

test.describe("reduced motion", () => {
  test.use({ colorScheme: "light" });
  test("hides the snow toggle", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const p = await context.newPage();
    await p.goto("/");
    await expect(p.locator('[data-testid="snow-toggle"]')).toHaveCount(0);
    await context.close();
  });
});

test("the CSP meta is present", async ({ page }) => {
  await goto(page, "/");
  const csp = await readCspMeta(page);
  expect(csp).toBeTruthy();
  expect(csp).toMatch(/default-src 'self'/);
  expect(csp).toMatch(/connect-src/);
});

test("the hub WebSocket to the gateway opens", async ({ page }) => {
  const opened: string[] = [];
  page.on("websocket", (ws) => {
    opened.push(ws.url());
  });
  await goto(page, "/");
  await page.waitForTimeout(15_000);
  // The gateway URL comes through the client's config. Just check at least
  // one WebSocket was opened by the site during the visit.
  expect(opened.length).toBeGreaterThan(0);
});
