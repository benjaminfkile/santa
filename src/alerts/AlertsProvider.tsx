// docs/site.md section 7.7, Alerts bell. While the visitor is signed in
// the provider fetches `GET /me/subscriptions` and `GET /me/alerts` in
// parallel: once per sign-in, again when the document becomes visible
// after at least five minutes hidden, and once 60 seconds after the
// store's snapshot url changes (a status change or a posted message is
// what produces alerts, and the outbox sends within a minute). Nothing is
// fetched while signed out, and signing out clears the lists. A failure or
// `SignInRequired` never throws: the lists stay as they were, empty until
// a fetch succeeds. Unread alerts are those with an id greater than the
// number stored under `wmsfo.alerts.seen` (absent means every alert is
// unread); `markSeen` stores the newest id.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { SignInRequired } from "../auth/getIdToken";
import {
  listAlerts,
  listMySubscriptions,
  type AlertItem,
  type Subscription,
} from "../api/subscriptions";
import { useStore } from "../store/useStore";
import { storageGet, storageSet } from "../lib/storage";
import { alertId } from "./alertId";

export const ALERTS_SEEN_KEY = "wmsfo.alerts.seen";

// How long the document must have been hidden before becoming visible
// fetches again.
export const ALERTS_AWAY_MS = 5 * 60 * 1000;

// The wait after a snapshot url change before the fetch.
export const ALERTS_AFTER_SNAPSHOT_MS = 60 * 1000;

export type AlertsValue = {
  alerts: AlertItem[];
  subscribed: boolean;
  unreadCount: number;
  // The highest id stored as seen, or null when nothing is stored.
  seenId: number | null;
  markSeen: () => void;
};

const EMPTY: AlertsValue = {
  alerts: [],
  subscribed: false,
  unreadCount: 0,
  seenId: null,
  markSeen: () => {},
};

const AlertsContext = createContext<AlertsValue | null>(null);

type Lists = { alerts: AlertItem[]; subscriptions: Subscription[] };

const NO_LISTS: Lists = { alerts: [], subscriptions: [] };

function readSeen(): number | null {
  const raw = storageGet(ALERTS_SEEN_KEY);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isActive(row: Subscription): boolean {
  const verified = row.verifiedAt !== null && row.verifiedAt !== undefined;
  const unsubscribed = row.unsubscribedAt !== null && row.unsubscribedAt !== undefined;
  return verified && !unsubscribed;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const signedIn = auth.status === "signedIn";
  const account = auth.status === "signedIn" ? auth.email : null;
  const snapshotUrl = useStore((s) => s.snapshotUrl);
  // The lists of the account they were fetched for; another account, or
  // none, reads as empty.
  const [loaded, setLoaded] = useState<{ account: string; lists: Lists } | null>(null);
  const [seenId, setSeenId] = useState<number | null>(() => readSeen());
  const lists = signedIn && loaded !== null && loaded.account === account ? loaded.lists : NO_LISTS;
  // The signed-in account; a response that lands after it changed is
  // dropped.
  const accountRef = useRef<string | null>(null);

  const load = useCallback(async (forAccount: string) => {
    try {
      const [subs, alerts] = await Promise.all([listMySubscriptions(), listAlerts()]);
      if (accountRef.current !== forAccount) return;
      setLoaded({
        account: forAccount,
        lists: { subscriptions: subs.items ?? [], alerts: alerts.items ?? [] },
      });
      setSeenId(readSeen());
    } catch (e) {
      if (accountRef.current === forAccount && e instanceof SignInRequired) setLoaded(null);
    }
  }, []);

  // Once per sign-in; signing out clears the lists.
  useEffect(() => {
    accountRef.current = account;
    if (account === null) return;
    void load(account);
    return () => {
      accountRef.current = null;
      setLoaded(null);
    };
  }, [account, load]);

  // Visible again after at least ALERTS_AWAY_MS hidden.
  useEffect(() => {
    if (account === null || typeof document === "undefined") return;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= ALERTS_AWAY_MS) void load(account);
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [account, load]);

  // One fetch ALERTS_AFTER_SNAPSHOT_MS after the snapshot url changes; a
  // further change inside the wait restarts it.
  const lastUrlRef = useRef(snapshotUrl);
  useEffect(() => {
    if (lastUrlRef.current === snapshotUrl) return;
    lastUrlRef.current = snapshotUrl;
    if (account === null) return;
    const t = window.setTimeout(() => void load(account), ALERTS_AFTER_SNAPSHOT_MS);
    return () => window.clearTimeout(t);
  }, [snapshotUrl, account, load]);

  const markSeen = useCallback(() => {
    let newest: number | null = null;
    for (const row of lists.alerts) {
      const id = alertId(row);
      if (newest === null || id > newest) newest = id;
    }
    if (newest === null) return;
    storageSet(ALERTS_SEEN_KEY, String(newest));
    setSeenId(newest);
  }, [lists.alerts]);

  const value = useMemo<AlertsValue>(() => {
    const unreadCount = lists.alerts.filter((row) => seenId === null || alertId(row) > seenId).length;
    return {
      alerts: lists.alerts,
      subscribed: lists.subscriptions.some(isActive),
      unreadCount,
      seenId,
      markSeen,
    };
  }, [lists, seenId, markSeen]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

// Outside a provider the hook reads the empty state.
export function useAlerts(): AlertsValue {
  return useContext(AlertsContext) ?? EMPTY;
}
