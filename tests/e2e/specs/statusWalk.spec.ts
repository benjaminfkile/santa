// docs/site.md section 22.2. The status walk on the dedicated
// "E2E walk" event (year 2100). Runs serially in a single worker; the
// harness aborts when the API is not the dev API or the admin token is
// not admin, and restores the previous current event at the end.

import { test, expect } from "@playwright/test";
import {
  assertDevApi,
  fetchCdnSnapshot,
  getAdminSnapshot,
  getMe,
  getState,
  goto,
  listEvents,
  patchEvent,
  personSignIn,
  postEventMessage,
  replay,
  setCurrentEvent,
  setEventStatus,
  waitForState,
} from "../harness";

test.describe.configure({ mode: "serial" });

const POLL_INTERVAL_MS = 5000;
const POLL_PLUS = POLL_INTERVAL_MS + 2000;

test.beforeAll(async () => {
  assertDevApi();
  const me = await getMe();
  if (!me.isAdmin) throw new Error("E2E admin token is not admin");
  const events = await listEvents();
  const live = events.find((e) => e.statusId === 3);
  if (live) throw new Error(`Refusing to run: event ${live.id} is currently live`);
});

test("status walk", async ({ page }) => {
  // Serial walk through every status with CDN polling waits between steps.
  test.setTimeout(300_000);
  // The route disclaimer dialog (site.md 7.6) opens once per session over the
  // live page and blocks pointer events until acknowledged; dismiss it whenever
  // it shows up.
  await page.addLocatorHandler(page.getByRole("button", { name: /i understand/i }), async (button) => {
    await button.click();
  });
  const events = await listEvents();
  const walk = events.find((e) => e.year === 2100 && e.name === "E2E walk");
  if (!walk) throw new Error("Dedicated E2E walk event (year 2100) is missing");
  const previousCurrent = events.find((e) => e.isCurrent && e.id !== walk.id) ?? null;

  await setCurrentEvent(walk.id);

  try {
    // 2. Ensure status 1; assert the planned page.
    await setEventStatus(walk.id, 1);
    await goto(page, "/");
    await waitForState(page, (s) => s?.live?.eventStatusId === 1, 15_000);
    const countdown = page.locator('[data-testid="countdown"]');
    expect(await countdown.count()).toBe(0);
    expect(await page.locator('[data-testid="map"]').count()).toBe(0);
    await expect(page.locator("body")).toContainText("E2E walk");

    // 3. status 2 with a scheduledAt 2 h in the future.
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await patchEvent(walk.id, { scheduledAt });
    await setEventStatus(walk.id, 2);
    // The digits render only once the snapshot carrying status 2 has arrived
    // (timeReady); the heading is there earlier, so wait for a number.
    await page.waitForFunction(
      "/\\d/.test(document.querySelector('[data-testid=\"countdown\"]')?.textContent ?? '')",
      undefined,
      { timeout: POLL_PLUS * 3 },
    );
    const first = await page.locator('[data-testid="countdown"]').first().textContent();
    await page.waitForTimeout(3000);
    const later = await page.locator('[data-testid="countdown"]').first().textContent();
    expect(later).not.toBe(first);

    // 4. status 3, live page with waiting-for-fix chip, live indicator.
    await setEventStatus(walk.id, 3);
    await page.waitForFunction(
      "!!document.querySelector('[data-testid=\"map\"]')",
      undefined,
      { timeout: POLL_PLUS },
    );
    // The live page mounts the map. On a fresh event the chip says waiting for a
    // fix; locations accumulate on the walk event in dev (site.md 22.2), and a
    // stale fix counts as tracking for 30 s after load (site.md 15), so the
    // chip's state is not asserted here.
    await expect(page.locator('[data-testid="map"]')).toBeVisible({ timeout: POLL_PLUS });
    const startedAt = Date.now();
    let hubLive = false;
    while (Date.now() - startedAt < 20_000) {
      const s = await getState(page);
      if (s.hub === "connected") {
        hubLive = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    if (!hubLive) {
      // Polling only: continue; log for observability.
      // eslint-disable-next-line no-console
      console.warn("hub did not reach connected within 20 s; polling only");
    }

    // 5. Replay 60 points; seq must increase; speed shows.
    const adminSnap = await getAdminSnapshot();
    const snapshot = await fetchCdnSnapshot(adminSnap.url);
    const routeUrl = snapshot.event?.routeUrl ?? null;
    if (routeUrl === null) throw new Error("Walk event has no route");
    const routeRes = await fetch(routeUrl, { credentials: "omit" });
    if (!routeRes.ok) throw new Error(`route fetch → ${routeRes.status}`);
    const route = (await routeRes.json()) as { points: { lat: number; lng: number }[] };
    const postedAt = Date.now();
    const rep = replay(route.points.slice(0, 60), 2);
    await waitForState(page, (s) => (s?.live?.seq ?? 0) > 0, POLL_PLUS);
    const latency = Date.now() - postedAt;
    // eslint-disable-next-line no-console
    console.log(`beacon-to-marker latency ${latency} ms`);
    await expect(page.locator('[data-testid="marker-seq"]')).toHaveAttribute("data-seq", /\d+/);
    // The data row lives in the tracker menu (site.md 7.6), which opens on demand.
    await page.getByRole("button", { name: /tracker menu/i }).click();
    await expect(page.locator('[data-testid="data-row-speed"]')).toContainText(/\d/);
    await page.keyboard.press("Escape");

    // 6. Sign in as the E2E person, drop a cookie, expect leaderboard tick.
    await personSignIn(page);
    await page.locator('[data-testid="cookie-control-open"]').click();
    const remainingText = await page.locator('[data-testid="cookie-remaining"]').textContent();
    const remaining = Number((remainingText ?? "0").replace(/\D+/g, ""));
    await page.locator('[data-testid="cookie-type"]').first().click();
    await page.locator('[data-testid="cookie-submit"]').click();
    await expect(page.locator('[data-testid="cookie-remaining"]')).toContainText(String(remaining - 1));
    await expect(page.locator('[data-testid="leaderboard-count"]').first()).toContainText(/\d+/, {
      timeout: 2 * POLL_INTERVAL_MS + 2000,
    });

    // 7. Post a message; expect it in the ticker.
    const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());
    const messageBody = `E2E ${runId}`;
    await postEventMessage(walk.id, { body: messageBody, eventTime: null });
    await waitForState(
      page,
      (s) => s?.snapshot?.event?.latestMessage?.body === messageBody,
      POLL_PLUS,
    );
    await expect(page.locator('[data-testid="latest-message"]')).toContainText(messageBody);

    // 8. Stop replay; signal-lost chip after 30 s; marker keeps position.
    rep.stop();
    await rep.done;
    const preLostPos = await page.locator('[data-testid="marker-seq"]').getAttribute("data-seq");
    await page.waitForTimeout(35_000);
    await expect(page.locator('[data-testid="signal-lost"]')).toBeVisible();
    const postLostPos = await page.locator('[data-testid="marker-seq"]').getAttribute("data-seq");
    expect(postLostPos).toBe(preLostPos);

    // 9. status 4: ended page, leaderboard + sponsor grid.
    await setEventStatus(walk.id, 4);
    await waitForState(page, (s) => s?.live?.eventStatusId === 4, POLL_PLUS);
    await expect(page.locator('[data-testid="leaderboard-count"]').first()).toContainText(/\d+/);
    expect(await page.locator('[data-testid="sponsor-logo"]').count()).toBeGreaterThan(0);

    // 10. status 5: cancelled page, message shown, no countdown.
    await setEventStatus(walk.id, 5);
    await waitForState(page, (s) => s?.live?.eventStatusId === 5, POLL_PLUS);
    await expect(page.locator("body")).toContainText(messageBody);
    expect(await page.locator('[data-testid="countdown"]').count()).toBe(0);
  } finally {
    // 11. Restore.
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
  }
});
