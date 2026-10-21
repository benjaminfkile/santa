// docs/site.md section 7.7, Alerts bell. The provider reads the current
// event's alerts from the store (`snapshot.event.alerts`, the same list
// for every visitor) and follows the read marker of `seenMarker.ts`
// through `subscribe`, so a raise from anywhere in this page load (the
// bell, the read of `GET /me/notifications`) re-renders it. Unread alerts
// are those with an id greater than the marker (absent means every alert
// is unread), for every visitor, signed in or not. `markSeen` raises the
// marker to the newest alert id; when it advanced, the visitor is signed
// in, and the subscription flag's `account` is the signed-in email, it
// also sends `PUT /me/notifications/seen` once, ignoring a failure.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { SnapshotAlert } from "../contracts";
import { useStore } from "../store/useStore";
import type { SiteStore } from "../store/types";
import { useAuth } from "../auth/AuthProvider";
import { putSeenUpTo } from "../api/subscriptions";
import { useSubscription } from "./SubscriptionProvider";
import { seenMarker } from "./seenMarker";

export { ALERTS_OLD_SEEN_KEY, ALERTS_SEEN_KEY } from "./seenMarker";

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

// The current event's alerts, or one shared empty list.
export function selectAlerts(s: SiteStore): SnapshotAlert[] {
  return s.snapshot?.event?.alerts ?? NO_ALERTS;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const alerts = useStore(selectAlerts);
  const seenId = useSyncExternalStore(seenMarker.subscribe, seenMarker.read, seenMarker.read);
  const { state: auth } = useAuth();
  const { flag } = useSubscription();
  const subscriber =
    auth.status === "signedIn" && flag !== null && flag.account === auth.email;

  const markSeen = useCallback(() => {
    let newest: number | null = null;
    for (const row of alerts) {
      if (newest === null || row.id > newest) newest = row.id;
    }
    if (newest === null) return;
    if (!seenMarker.raise(newest) || !subscriber) return;
    putSeenUpTo(newest).catch(() => {
      // A failure is ignored; the next open that advances the marker sends again.
    });
  }, [alerts, subscriber]);

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
