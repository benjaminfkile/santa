// docs/site.md section 5.3. Pure functions; the only path a live object
// takes into the store.

import type { LiveObject } from "../contracts";
import type { SiteStore } from "./types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function shouldReplace(cur: LiveObject | null, L: LiveObject): boolean {
  if (cur === null) return true;
  if (L.eventId !== cur.eventId) return (L.publishedAt ?? "") > (cur.publishedAt ?? "");
  if (cur.seq !== null && cur.seq !== undefined && (L.seq === null || L.seq === undefined)) return false;
  if (
    cur.seq !== null &&
    cur.seq !== undefined &&
    L.seq !== null &&
    L.seq !== undefined &&
    L.seq < cur.seq
  ) {
    return false;
  }
  if (L.seq === cur.seq && (L.publishedAt ?? "") <= (cur.publishedAt ?? "")) return false;
  return true;
}

export type ApplyResult = {
  state: SiteStore;
  applied: boolean;
  snapshotUrlChanged: boolean;
};

export function applyLive(state: SiteStore, L: unknown, now: number): ApplyResult {
  if (!isRecord(L) || L.schemaVersion !== 1) {
    return {
      state: { ...state, schemaMismatch: true },
      applied: false,
      snapshotUrlChanged: false,
    };
  }
  const live = L as LiveObject;
  if (!shouldReplace(state.live, live)) {
    return { state, applied: false, snapshotUrlChanged: false };
  }
  const seqChanged = state.live === null || state.live.seq !== live.seq;
  const nextState: SiteStore = {
    ...state,
    live,
    lastSeqChangeAt: seqChanged ? now : state.lastSeqChangeAt,
  };
  return {
    state: nextState,
    applied: true,
    snapshotUrlChanged: (live.snapshotUrl ?? null) !== state.snapshotUrl,
  };
}
