// docs/site.md section 5.4 (selectors on the applied live object and snapshot).

import type { SiteStore } from "./types";

export type LiveState = "waitingForFix" | "tracking" | "signalLost";

export function selectLiveState(s: SiteStore, now: number): LiveState {
  if (s.live?.seq == null) return "waitingForFix";
  return s.lastSeqChangeAt !== null && now - s.lastSeqChangeAt > 30000
    ? "signalLost"
    : "tracking";
}

export function selectTimeReady(s: SiteStore): boolean {
  return (s.snapshot?.event?.statusId ?? null) === (s.live?.eventStatusId ?? null);
}
