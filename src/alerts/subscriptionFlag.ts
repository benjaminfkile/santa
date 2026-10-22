// docs/site.md section 7.7, The subscription flag. The one alerts
// subscription this browser knows of, kept under
// `localStorage["wmsfo.alerts.subscription"]` as
// `{ account, id, address, state }` through `storageGet` and `storageSet`,
// or nothing. `account` is the signed-in email the flag belongs to;
// `state` is "pending" until the address is confirmed, then "active". A
// stored value of any other shape reads as no flag. `onFlagChange`
// listeners hear every `writeFlag` and `removeFlag`, so a flag written
// outside the provider (the sign-up alerts intent) reaches its state.

import { storageGet, storageRemove, storageSet } from "../lib/storage";
import type { Subscription } from "../api/subscriptions";

export const SUBSCRIPTION_FLAG_KEY = "wmsfo.alerts.subscription";

export type SubscriptionState = "pending" | "active";

export type SubscriptionFlag = {
  account: string;
  id: number;
  address: string;
  state: SubscriptionState;
};

type FlagListener = () => void;
const listeners = new Set<FlagListener>();

export function onFlagChange(listener: FlagListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

export function readFlag(): SubscriptionFlag | null {
  const raw = storageGet(SUBSCRIPTION_FLAG_KEY);
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as Partial<SubscriptionFlag> | null;
    if (v === null || typeof v !== "object") return null;
    if (typeof v.account !== "string" || typeof v.address !== "string") return null;
    if (typeof v.id !== "number" || !Number.isFinite(v.id)) return null;
    if (v.state !== "pending" && v.state !== "active") return null;
    return { account: v.account, id: v.id, address: v.address, state: v.state };
  } catch {
    return null;
  }
}

export function writeFlag(flag: SubscriptionFlag): void {
  storageSet(
    SUBSCRIPTION_FLAG_KEY,
    JSON.stringify({ account: flag.account, id: flag.id, address: flag.address, state: flag.state }),
  );
  notify();
}

export function removeFlag(): void {
  storageRemove(SUBSCRIPTION_FLAG_KEY);
  notify();
}

// A subscription row's id as a number; the API sends int64 ids as a
// number or a string.
export function subscriptionId(row: Subscription): number {
  const v = row.id;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// The flag a subscription row stands for: active when verified, pending
// otherwise.
export function flagFromRow(account: string, row: Subscription): SubscriptionFlag {
  const verified = row.verifiedAt !== null && row.verifiedAt !== undefined;
  return {
    account,
    id: subscriptionId(row),
    address: row.address ?? "",
    state: verified ? "active" : "pending",
  };
}
