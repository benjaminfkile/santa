// docs/site.md section 7.7, Alerts bell. The read marker: the one number
// under `localStorage["wmsfo.alerts.seenId"]`, the id of the newest
// snapshot alert this browser has seen (absent means none). `read()`
// returns it, `raise(id)` stores `id` only when it is higher than the
// stored value and says whether it advanced, and `subscribe(listener)`
// tells every listener of each change in this page load. The old key
// `wmsfo.alerts.seen` held ids of another id space and is removed on the
// first read.

import { storageGet, storageRemove, storageSet } from "../lib/storage";

export const ALERTS_SEEN_KEY = "wmsfo.alerts.seenId";

// The earlier seen key, removed by the first read.
export const ALERTS_OLD_SEEN_KEY = "wmsfo.alerts.seen";

type Listener = () => void;

const listeners = new Set<Listener>();

export function read(): number | null {
  if (storageGet(ALERTS_OLD_SEEN_KEY) !== null) storageRemove(ALERTS_OLD_SEEN_KEY);
  const raw = storageGet(ALERTS_SEEN_KEY);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function raise(id: number): boolean {
  if (!Number.isFinite(id)) return false;
  const current = read();
  if (current !== null && id <= current) return false;
  storageSet(ALERTS_SEEN_KEY, String(id));
  for (const l of listeners) l();
  return true;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const seenMarker = { read, raise, subscribe };
