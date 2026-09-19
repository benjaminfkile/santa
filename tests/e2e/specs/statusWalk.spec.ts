// docs/site.md section 22.2. The status walk on the dedicated
// "E2E walk" event (year 2100). Runs serially in a single worker; the
// harness aborts when the API is not the dev API or the admin token is
// not admin, and restores the previous current event at the end. The
// walk finds or creates its own event (kept between runs, always left
// at status 1 and not current) and creates and enrolls its own beacon
// through the admin API and the enroll endpoint (contracts 3.3, 3.4,
// 4.5 Beacons), using that key for heartbeats and fixes; the beacon is
// revoked in the finally.

import { test, expect } from "@playwright/test";
import {
  activateBeacon,
  assertDevApi,
  createBeacon,
  createEvent,
  enrollBeacon,
  fetchCdnSnapshot,
  getAdminSnapshot,
  getMe,
  getState,
  goto,
  heartbeat,
  listBeacons,
  listEvents,
  patchEvent,
  personSignIn,
  postEventMessage,
  replay,
  revokeBeacon,
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
  const existing = events.find((e) => e.year === 2100 && e.name === "E2E walk");
  const walk = existing ?? (await createEvent({ year: 2100, name: "E2E walk", inheritRoute: true }));
  const previousCurrent = events.find((e) => e.isCurrent && e.id !== walk.id) ?? null;

  // 1. Record the currently active beacon so it can be restored at the end
  // (contracts 4.5 Events: status 3 refuses without a healthy active beacon,
  // 409 no_healthy_beacon), then create a fresh beacon for this run and
  // enroll it as a real beacon would (contracts 3.3 and 3.4).
  const beacons = await listBeacons();
  const previousActiveBeacon = beacons.find((b) => b.isActive) ?? null;
  const created = await createBeacon({ name: `e2e-walk-${Date.now()}` });
  const enrolled = await enrollBeacon(created.enrollment.token);
  const beaconKey = enrolled.key;
  const beaconId = created.beacon.id;

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
    // The API refuses status 3 without a healthy active beacon (contracts
    // 4.5 Events, 409 no_healthy_beacon); activate the walk's beacon and
    // send one heartbeat so its lastSeenAt is fresh (contracts 4.2).
    await activateBeacon(beaconId);
    await heartbeat(beaconKey);
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

    // 5. Replay 60 points from the embedded flight history; seq must
    //    increase; speed shows. Turn the flight history toggle on and
    //    assert one polyline is drawn (the flight history overlay) and
    //    that the marker's seq changes across replay while the polyline
    //    stays put; the marker is the only thing that moves.
    const adminSnap = await getAdminSnapshot();
    const snapshot = await fetchCdnSnapshot(adminSnap.url);
    const points = snapshot.event?.flightHistory?.points ?? null;
    if (points === null || points.length === 0) throw new Error("Walk event has no flight history");
    const postedAt = Date.now();
    // Flight-history points carry only lat/lng (and recordedAt); a real fix
    // carries speed, heading, altitude, and accuracy too, which the data
    // row renders.
    const fixes = points.slice(0, 60).map((p) => ({
      ...p,
      speedMps: 45,
      headingDeg: 90,
      altitudeM: 1200,
      accuracyM: 5,
    }));
    // Turn the flight history toggle on before replay so the polyline is
    // drawn from the embedded snapshot history rather than the incoming
    // fixes.
    await page.getByRole("button", { name: /tracker menu/i }).click();
    await page.locator('[data-testid="tracker-menu-flight-history"]').click();
    await page.keyboard.press("Escape");
    const rep = replay(fixes, 2, beaconKey);
    await waitForState(page, (s) => (s?.live?.seq ?? 0) > 0, POLL_PLUS);
    const latency = Date.now() - postedAt;
    // eslint-disable-next-line no-console
    console.log(`beacon-to-marker latency ${latency} ms`);
    await expect(page.locator('[data-testid="marker-seq"]')).toHaveAttribute("data-seq", /\d+/);
    // The flight history overlay draws onto the Maps canvas (no DOM of its
    // own), so the map root reports it through `data-flight-history`; the
    // Santa marker updates in place via the imperative controller. Across
    // 2 s the overlay stays on (the marker is the only thing that moves)
    // while the marker's `data-seq` increases.
    const mapRoot = page.locator('[data-testid="map"]');
    await expect(mapRoot).toHaveAttribute("data-flight-history", "on");
    const seqFirst = await page.locator('[data-testid="marker-seq"]').getAttribute("data-seq");
    await page.waitForTimeout(2000);
    const seqLater = await page.locator('[data-testid="marker-seq"]').getAttribute("data-seq");
    expect(seqLater).not.toBe(seqFirst);
    await expect(mapRoot).toHaveAttribute("data-flight-history", "on");
    // The data row lives in the tracker menu (site.md 7.6), which opens on demand.
    await page.getByRole("button", { name: /tracker menu/i }).click();
    await expect(page.locator('[data-testid="data-row-speed"]')).toContainText(/\d/);
    await page.keyboard.press("Escape");

    // 6. Sign in as the E2E person, drop a cookie, expect leaderboard tick.
    await personSignIn(page);
    await page.locator('[data-testid="cookie-control-open"]').click();
    const remainingText = await page.locator('[data-testid="cookie-remaining"]').textContent();
    // The control reads "9 of 10 left": the first number is what remains.
    const remaining = Number((remainingText ?? "").match(/\d+/)?.[0] ?? "0");
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
      (s, body) => s?.snapshot?.event?.latestMessage?.body === body,
      POLL_PLUS,
      messageBody,
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
    // The walk event's year carries sponsors only when an admin linked some;
    // the grid renders either way, logos only with sponsors in the snapshot.
    const sponsorCount = (await getState(page)).snapshot?.sponsors?.length ?? 0;
    if (sponsorCount > 0) {
      expect(await page.locator('[data-testid="sponsor-logo"]').count()).toBeGreaterThan(0);
    } else {
      console.log("no sponsors linked to the walk event's year; logo check skipped");
    }

    // 10. status 5: cancelled page, message shown, no countdown.
    await setEventStatus(walk.id, 5);
    await waitForState(page, (s) => s?.live?.eventStatusId === 5, POLL_PLUS);
    await expect(page.locator("body")).toContainText(messageBody);
    expect(await page.locator('[data-testid="countdown"]').count()).toBe(0);
  } finally {
    // 11. Restore. The walk event is kept between runs; leave it at status 1.
    try {
      await setEventStatus(walk.id, 1);
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
    if (previousActiveBeacon && previousActiveBeacon.id !== beaconId) {
      try {
        await activateBeacon(previousActiveBeacon.id);
      } catch {
        // ignore
      }
    }
    try {
      await revokeBeacon(beaconId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`revoke of e2e walk beacon ${beaconId} failed`, err);
    }
  }
});
