// docs/site.md sections 6.1, 6.4, 6.5, 6.6. Startup, poll timer, URL change
// handling, visibility and lifecycle events. Runs once from main.tsx.

import { store as defaultStore, type StoreHandle } from "./store";
import { applyLive } from "./applyLive";
import { pollCadenceMs } from "./cadence";
import { backoffAt } from "./backoff";
import { fetchLive, fetchSnapshot, fetchRoute, SchemaVersionError } from "./fetchers";
import type { Snapshot } from "../contracts";

export type LoopDeps = {
  store?: StoreHandle;
  now?: () => number;
  document?: Document;
  window?: Window;
  onFirstApplied?: () => void | Promise<void>;
};

let started = false;
let stopping = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let snapshotInFlight: string | null = null;
let routeInFlight: string | null = null;
let pollNowFn: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;
let currentDoc: Document | null = null;
let currentWin: Window | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function startDataLoop(deps: LoopDeps = {}): Promise<void> {
  if (started) return;
  started = true;
  stopping = false;

  const store = deps.store ?? defaultStore;
  const now = deps.now ?? (() => performance.now());
  const doc = deps.document ?? (typeof document !== "undefined" ? document : null);
  const win = deps.window ?? (typeof window !== "undefined" ? window : null);
  currentDoc = doc;
  currentWin = win;

  store.setState((s) => ({ ...s, diag: { ...s.diag, firstLoadStartedAt: now() } }));

  // Step 1: fetch the first live object with 1, 2, 3, 5 s backoff.
  let attempt = 0;
  while (!stopping) {
    try {
      const obj = await fetchLive();
      const applied = await applyAndFetchDependents(store, obj, now);
      if (applied) break;
      // Not applied (schemaMismatch or shouldReplace false); keep loading.
    } catch {
      // network/timeout/parse failure
    }
    await sleep(backoffAt(attempt));
    attempt += 1;
  }

  if (stopping) return;

  // Register visibility and online/offline listeners.
  registerListeners(store, doc, win);

  // Arm the poll timer.
  arm(store, doc, now);

  // Fire and forget: onFirstApplied hook (used to import and start the hub).
  if (deps.onFirstApplied) {
    void deps.onFirstApplied();
  }
}

async function applyAndFetchDependents(
  store: StoreHandle,
  obj: unknown,
  now: () => number,
): Promise<boolean> {
  const before = store.getState();
  const result = applyLive(before, obj, now());
  store.setState(() => result.state);
  // The snapshot follows the live object's snapshotUrl whether or not this
  // particular object was new: a live object applied by the hub may already be
  // in the store while its snapshot has not been fetched yet (site.md 6.4).
  const wanted = result.state.live?.snapshotUrl ?? null;
  if (wanted !== null) {
    if (wanted !== result.state.snapshotUrl) void fetchSnapshotWithBackoff(store, wanted);
  } else if (result.state.snapshotUrl !== null) {
    // Cleared snapshotUrl: drop snapshot and route.
    store.setState({ snapshot: null, snapshotUrl: null, route: null, routeUrl: null });
  }
  return result.applied;
}

// The hub's `location` events go through the same path as a poll so the
// snapshot and route follow a pushed live object too.
export function applyIncomingLive(store: StoreHandle, obj: unknown, now: () => number): Promise<boolean> {
  return applyAndFetchDependents(store, obj, now);
}

async function fetchSnapshotWithBackoff(
  store: StoreHandle,
  wantedUrl: string,
): Promise<void> {
  if (snapshotInFlight === wantedUrl) return;
  snapshotInFlight = wantedUrl;
  let attempt = 0;
  try {
    while (!stopping) {
      const currentWanted = store.getState().live?.snapshotUrl ?? null;
      if (currentWanted !== wantedUrl) return; // no longer wanted
      try {
        const snap = (await fetchSnapshot(wantedUrl)) as Snapshot;
        // Only commit if still wanted.
        if ((store.getState().live?.snapshotUrl ?? null) !== wantedUrl) return;
        store.setState((s) => ({
          ...s,
          snapshot: snap,
          snapshotUrl: wantedUrl,
          diag: { ...s.diag, snapshotFetchFailing: false },
        }));
        // Reconcile route.
        void reconcileRoute(store, (snap.event as { routeUrl?: string | null } | null | undefined)?.routeUrl ?? null);
        return;
      } catch (err) {
        if (err instanceof SchemaVersionError) {
          store.setState({ schemaMismatch: true });
          return;
        }
        store.setState((s) => ({ ...s, diag: { ...s.diag, snapshotFetchFailing: true } }));
        await sleep(backoffAt(attempt));
        attempt += 1;
      }
    }
  } finally {
    if (snapshotInFlight === wantedUrl) snapshotInFlight = null;
  }
}

async function reconcileRoute(
  store: StoreHandle,
  wantedUrl: string | null,
): Promise<void> {
  const current = store.getState().routeUrl;
  if (wantedUrl === current) return;
  if (wantedUrl === null) {
    store.setState({ route: null, routeUrl: null });
    return;
  }
  if (routeInFlight === wantedUrl) return;
  routeInFlight = wantedUrl;
  let attempt = 0;
  try {
    while (!stopping) {
      const currentWantedRoute = (store.getState().snapshot?.event as { routeUrl?: string | null } | null | undefined)?.routeUrl ?? null;
      if (currentWantedRoute !== wantedUrl) return;
      try {
        const route = await fetchRoute(wantedUrl);
        if (((store.getState().snapshot?.event as { routeUrl?: string | null } | null | undefined)?.routeUrl ?? null) !== wantedUrl) return;
        store.setState((s) => ({
          ...s,
          route: route as never,
          routeUrl: wantedUrl,
          diag: { ...s.diag, routeFetchFailing: false },
        }));
        return;
      } catch (err) {
        if (err instanceof SchemaVersionError) {
          store.setState({ schemaMismatch: true });
          return;
        }
        store.setState((s) => ({ ...s, diag: { ...s.diag, routeFetchFailing: true } }));
        await sleep(backoffAt(attempt));
        attempt += 1;
      }
    }
  } finally {
    if (routeInFlight === wantedUrl) routeInFlight = null;
  }
}

function arm(store: StoreHandle, doc: Document | null, now: () => number): void {
  if (pollTimer !== null) return;
  if (doc && doc.hidden) return;
  const delay = pollCadenceMs(store.getState(), now());
  pollTimer = setTimeout(() => void tick(store, doc, now), delay);
}

async function tick(store: StoreHandle, doc: Document | null, now: () => number): Promise<void> {
  pollTimer = null;
  if ((doc && doc.hidden) || inFlight) return;
  inFlight = true;
  try {
    const obj = await fetchLive();
    await applyAndFetchDependents(store, obj, now);
    store.setState((s) => ({
      ...s,
      diag: { ...s.diag, lastPollOkAt: now(), consecutivePollFailures: 0 },
    }));
  } catch {
    store.setState((s) => ({
      ...s,
      diag: { ...s.diag, consecutivePollFailures: s.diag.consecutivePollFailures + 1 },
    }));
  } finally {
    inFlight = false;
    arm(store, doc, now);
  }
}

function makePollNow(store: StoreHandle, doc: Document | null, now: () => number): () => void {
  return () => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    void tick(store, doc, now);
  };
}

export function pollNow(): void {
  if (pollNowFn) pollNowFn();
}

function registerListeners(store: StoreHandle, doc: Document | null, win: Window | null): void {
  const now = (): number => performance.now();
  pollNowFn = makePollNow(store, doc, now);
  if (doc) {
    visibilityHandler = () => {
      if (doc.hidden) {
        if (pollTimer !== null) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      } else {
        pollNowFn?.();
      }
    };
    doc.addEventListener("visibilitychange", visibilityHandler);
  }
  if (win) {
    onlineHandler = () => {
      store.setState((s) => ({ ...s, diag: { ...s.diag, online: true } }));
      pollNowFn?.();
    };
    offlineHandler = () => {
      store.setState((s) => ({ ...s, diag: { ...s.diag, online: false } }));
    };
    win.addEventListener("online", onlineHandler);
    win.addEventListener("offline", offlineHandler);
  }
}

export function _resetLoopForTests(): void {
  stopping = true;
  started = false;
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  inFlight = false;
  snapshotInFlight = null;
  routeInFlight = null;
  if (currentDoc && visibilityHandler) {
    currentDoc.removeEventListener("visibilitychange", visibilityHandler);
  }
  if (currentWin && onlineHandler) {
    currentWin.removeEventListener("online", onlineHandler);
  }
  if (currentWin && offlineHandler) {
    currentWin.removeEventListener("offline", offlineHandler);
  }
  visibilityHandler = null;
  onlineHandler = null;
  offlineHandler = null;
  pollNowFn = null;
  currentDoc = null;
  currentWin = null;
  stopping = false;
}
