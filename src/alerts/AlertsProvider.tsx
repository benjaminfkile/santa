// docs/site.md section 7.7, Alerts bell. The provider reads the current
// event's alerts from the store (`snapshot.event.alerts`, the same list
// for every visitor) and makes no API call. Unread alerts are those with
// an id greater than the number stored under `wmsfo.alerts.seenId`
// (absent means every alert is unread); `markSeen` stores the newest id.
// The old `wmsfo.alerts.seen` key held ids of another id space and is
// removed on the first read.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SnapshotAlert } from "../contracts";
import { useStore } from "../store/useStore";
import type { SiteStore } from "../store/types";
import { storageGet, storageRemove, storageSet } from "../lib/storage";

export const ALERTS_SEEN_KEY = "wmsfo.alerts.seenId";

// The earlier seen key, removed by the first read.
export const ALERTS_OLD_SEEN_KEY = "wmsfo.alerts.seen";

export type AlertsValue = {
  alerts: SnapshotAlert[];
  unreadCount: number;
  // The highest id stored as seen, or null when nothing is stored.
  seenId: number | null;
  markSeen: () => void;
};

const NO_ALERTS: SnapshotAlert[] = [];

const EMPTY: AlertsValue = {
  alerts: NO_ALERTS,
  unreadCount: 0,
  seenId: null,
  markSeen: () => {},
};

const AlertsContext = createContext<AlertsValue | null>(null);

function readSeen(): number | null {
  if (storageGet(ALERTS_OLD_SEEN_KEY) !== null) storageRemove(ALERTS_OLD_SEEN_KEY);
  const raw = storageGet(ALERTS_SEEN_KEY);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// The current event's alerts, or one shared empty list.
export function selectAlerts(s: SiteStore): SnapshotAlert[] {
  return s.snapshot?.event?.alerts ?? NO_ALERTS;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const alerts = useStore(selectAlerts);
  const [seenId, setSeenId] = useState<number | null>(() => readSeen());

  const markSeen = useCallback(() => {
    let newest: number | null = null;
    for (const row of alerts) {
      if (newest === null || row.id > newest) newest = row.id;
    }
    if (newest === null) return;
    storageSet(ALERTS_SEEN_KEY, String(newest));
    setSeenId(newest);
  }, [alerts]);

  const value = useMemo<AlertsValue>(() => {
    const unreadCount = alerts.filter((row) => seenId === null || row.id > seenId).length;
    return { alerts, unreadCount, seenId, markSeen };
  }, [alerts, seenId, markSeen]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

// Outside a provider the hook reads the empty state.
export function useAlerts(): AlertsValue {
  return useContext(AlertsContext) ?? EMPTY;
}
