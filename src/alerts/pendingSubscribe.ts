// docs/site.md sections 7.7 and 11.2, The sign-up alerts intent. When the
// sign-up page's alerts box is checked, the address is kept under
// `localStorage["wmsfo.alerts.subscribeOnSignUp"]` (an address only, never
// a password) through `storageGet` and `storageSet`; a stored value of any
// other shape reads as none. `completePendingSubscribe(email)` runs after
// the confirm page's direct sign-in and after a hand sign-in: when the
// stored address equals the signed-in email it calls
// `POST /me/subscriptions` and writes the subscription flag from the row.
// A `409 already_subscribed` adopts the account's row through one
// `GET /me/notifications`. `409 address_taken`, `409 subscriptions_closed`
// and any `400` clear the intent and stop; a network failure keeps it for
// the next sign-in. It never throws.

import { storageGet, storageRemove, storageSet } from "../lib/storage";
import { createSubscription, getMyNotifications } from "../api/subscriptions";
import { ApiRequestError } from "../api/client";
import { flagFromRow, writeFlag } from "./subscriptionFlag";

export const PENDING_SUBSCRIBE_KEY = "wmsfo.alerts.subscribeOnSignUp";

// A lowercased address with no spaces, quotes, or brackets.
const ADDRESS_RE = /^[^\s@"'{}[\]<>]+@[^\s@"'{}[\]<>]+\.[^\s@"'{}[\]<>]+$/;

export function setPendingSubscribe(address: string): void {
  storageSet(PENDING_SUBSCRIBE_KEY, address.trim().toLowerCase());
}

export function readPendingSubscribe(): string | null {
  const raw = storageGet(PENDING_SUBSCRIBE_KEY);
  if (raw === null || raw !== raw.toLowerCase() || !ADDRESS_RE.test(raw)) return null;
  return raw;
}

export function clearPendingSubscribe(): void {
  storageRemove(PENDING_SUBSCRIBE_KEY);
}

export async function completePendingSubscribe(email: string): Promise<void> {
  const address = readPendingSubscribe();
  if (address === null || address !== email.trim().toLowerCase()) return;
  try {
    const row = await createSubscription(address);
    writeFlag(flagFromRow(email, row));
    clearPendingSubscribe();
  } catch (e) {
    if (!(e instanceof ApiRequestError)) return;
    if (e.status === 409 && e.code === "already_subscribed") {
      clearPendingSubscribe();
      try {
        const res = await getMyNotifications();
        const existing = res.subscription ?? null;
        if (existing !== null) writeFlag(flagFromRow(email, existing));
      } catch {
        // The alerts section adopts the row on its own later.
      }
      return;
    }
    if (e.status === 400 || e.status === 409) clearPendingSubscribe();
  }
}
