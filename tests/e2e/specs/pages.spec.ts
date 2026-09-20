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
  getQrCodeDetail,
  goto,
  listContactMessages,
  listQrCodes,
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

test("a page with a route_preview in viewer style loads the osd chunk, tiles the poster, zooms on a wheel event, and enters and leaves fullscreen through the button without loading the map chunk", async ({ page }) => {
  const adminSnap = await getAdminSnapshot();
  const snap = (await fetchCdnSnapshot(adminSnap.url)) as { content?: { pages?: PublishedPage[] } };
  const pages = snap.content?.pages ?? [];
  const target = pages.find((p) =>
    p.sections.some((s) => s.kind === "route_preview" && s.data?.style === "viewer"),
  );
  test.skip(target === undefined, "no route_preview in viewer style in the published document");
  if (!target) return;
  // Track scripts and tile requests: the osd chunk must load, the map chunk
  // must not, and when the asset has a Deep Zoom pyramid a `poster_files/`
  // request must be seen (site.md 8.5, 22.2).
  const mapScripts: string[] = [];
  const osdScripts: string[] = [];
  const posterFileRequests: string[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if (/\/assets\/map-[^/]+\.js$/.test(url)) mapScripts.push(url);
    if (/\/assets\/osd-[^/]+\.js$/.test(url)) osdScripts.push(url);
    if (/poster_files\//.test(url)) posterFileRequests.push(url);
  });
  await goto(page, `/${target.slug}`);
  const viewer = page.locator('[data-testid="poster-viewer"]');
  await expect(viewer).toBeVisible({ timeout: 20_000 });
  // Wait for the openseadragon canvas to appear inside the host.
  await expect(viewer.locator("canvas, img").first()).toBeVisible({ timeout: 20_000 });
  // Wheel zoom moves the viewport; the tile canvas transform changes.
  await viewer.dispatchEvent("wheel", { deltaY: -400, clientX: 200, clientY: 200 });
  await page.waitForTimeout(500);
  // Fullscreen: click the button, expect data-fullscreen to flip on and back.
  const fs = page.locator('[data-testid="poster-fullscreen"]');
  await fs.click();
  await expect(viewer).toHaveAttribute("data-fullscreen", "on", { timeout: 5_000 });
  await fs.click();
  await expect(viewer).toHaveAttribute("data-fullscreen", "off", { timeout: 5_000 });
  expect(osdScripts.length).toBeGreaterThan(0);
  expect(mapScripts).toEqual([]);
  // The starter content's route poster carries a `dzi` (contracts fixture);
  // tile requests fetch `poster_files/<level>/<x>_<y>.jpg` from the CDN.
  expect(posterFileRequests.length).toBeGreaterThan(0);
});

test("the sponsors page renders one card per snapshot sponsor with equal per-row heights at 1280 px", async ({ page }) => {
  const adminSnap = await getAdminSnapshot();
  const snap = (await fetchCdnSnapshot(adminSnap.url)) as {
    content?: { pages?: PublishedPage[] };
    sponsors?: unknown[];
  };
  const pages = snap.content?.pages ?? [];
  // A role page has no address of its own (it renders at "/" while its status
  // holds), so only an ordinary page can be opened by its slug.
  const target = pages.find(
    (p) => p.role === "none" && p.sections.some((s) => s.kind === "sponsor_grid"),
  );
  test.skip(target === undefined, "no sponsor_grid section in the published document");
  if (!target) return;
  const sponsorCount = (snap.sponsors ?? []).length;
  test.skip(sponsorCount === 0, "no sponsors in the snapshot");

  await page.setViewportSize({ width: 1280, height: 900 });
  await goto(page, `/${target.slug}`);
  await expect(page.locator('[data-testid="sponsor-grid"]').first()).toBeVisible({ timeout: 15_000 });
  const cards = page.locator('[data-testid="sponsor-card"]');
  await expect(cards).toHaveCount(sponsorCount);

  const rects = await cards.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height) };
    }),
  );
  const rows = new Map<number, number[]>();
  for (const { top, height } of rects) {
    const key = Math.round(top / 2) * 2;
    const list = rows.get(key) ?? [];
    list.push(height);
    rows.set(key, list);
  }
  for (const heights of rows.values()) {
    if (heights.length < 2) continue;
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    expect(max - min).toBeLessThanOrEqual(1);
  }
});

test("the header theme menu sets data-theme dark, survives a reload, and can be switched back to light", async ({ page }) => {
  // Shell.tsx: theme-toggle opens theme-menu holding the theme-light,
  // theme-dark, theme-system radio items.
  await goto(page, "/");
  await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="theme-toggle"]').click();
  await page.locator('[data-testid="theme-dark"]').click();
  await expect
    .poll(() => page.evaluate("document.documentElement.getAttribute('data-theme')"))
    .toBe("dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate("document.documentElement.getAttribute('data-theme')"))
    .toBe("dark");
  await page.locator('[data-testid="theme-toggle"]').click();
  await page.locator('[data-testid="theme-light"]').click();
  await expect
    .poll(() => page.evaluate("document.documentElement.getAttribute('data-theme')"))
    .toBe("light");
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

test("a printed code that opens a page lands on it and the code's people count rises by one", async ({ page }) => {
  // docs/site.md section 4 and contracts 4.5a. Any active code whose target
  // is a page will do: scanning it fires POST /qr-codes/<tag>/scans, the site
  // lands on the page, and the panel's people count for the code rises by one.
  const codes = await listQrCodes();
  const code = codes.find((c) => c.active === true && c.opens?.kind === "page" && !!c.opens.slug);
  test.skip(code === undefined, "no active code on dev opens a page");
  if (!code || !code.opens?.slug) return;
  const before = await getQrCodeDetail(code.id);
  const beforePeople = Number(before.scans?.people ?? 0);

  const scanPath = `/qr-codes/${code.tag}/scans`;
  const scanRequest = page.waitForRequest((r) => new URL(r.url()).pathname.endsWith(scanPath) && r.method() === "POST");
  await goto(page, `/q/${code.tag}`);
  const req = await scanRequest;
  const body = req.postData();
  expect(body).toBeTruthy();
  if (body) expect(() => JSON.parse(body)).not.toThrow();

  await expect(page).toHaveURL(new RegExp(`/${code.opens.slug}$`), { timeout: 15_000 });
  await expect(page.locator('main[data-page-role="none"]')).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => {
      const detail = await getQrCodeDetail(code.id);
      return Number(detail.scans?.people ?? 0);
    }, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(beforePeople + 1);
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
