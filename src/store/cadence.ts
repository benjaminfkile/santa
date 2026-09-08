// docs/site.md section 5.5. Quiet cadence only in status 3.

import type { SiteStore } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const MIN_QUIET_POLL_INTERVAL_MS = 1000;

export function isHubQuiet(s: SiteStore, now: number): boolean {
  const live = s.live;
  if (live === null || live.eventStatusId !== 3) return false;
  const pollIntervalMs = live.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  return (
    s.hub !== "connected" ||
    s.lastHubLocationAt === null ||
    now - s.lastHubLocationAt > 2 * pollIntervalMs
  );
}

export function pollCadenceMs(s: SiteStore, now: number): number {
  const base = s.live?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  return isHubQuiet(s, now) ? Math.max(MIN_QUIET_POLL_INTERVAL_MS, Math.floor(base / 2)) : base;
}
