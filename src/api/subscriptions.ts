// docs/site.md sections 13 and 12. Alerts subscription API wrappers. The
// alerts themselves ride in the snapshot (`snapshot.event.alerts`), so
// nothing here reads them; `getMyNotifications` reads the person's open
// subscription and how far they have read, and `putSeenUpTo` records it.

import { api } from "./client";
import type { components } from "../contracts";

export type Subscription = components["schemas"]["SubscriptionDto"];
export type MeNotifications = components["schemas"]["MeNotificationsResponse"];

export function getMyNotifications(): Promise<MeNotifications> {
  return api<MeNotifications>("/me/notifications", { method: "GET", auth: true });
}

export function putSeenUpTo(id: number): Promise<void> {
  return api<void>("/me/notifications/seen", {
    method: "PUT",
    auth: true,
    body: { seenUpToId: id },
  });
}

export function createSubscription(address: string): Promise<Subscription> {
  return api<Subscription>("/me/subscriptions", {
    method: "POST",
    auth: true,
    body: { channel: "email", address },
  });
}

export function resendVerification(id: number): Promise<Subscription> {
  return api<Subscription>(`/me/subscriptions/${id}/resend-verification`, {
    method: "POST",
    auth: true,
  });
}

export function deleteSubscription(id: number): Promise<void> {
  return api<void>(`/me/subscriptions/${id}`, { method: "DELETE", auth: true });
}

export function verifySubscription(token: string): Promise<{ verifiedAt: string }> {
  return api<{ verifiedAt: string }>("/subscriptions/verify", {
    method: "POST",
    auth: false,
    body: { token },
  });
}

export function unsubscribe(token: string): Promise<void> {
  return api<void>("/subscriptions/unsubscribe", {
    method: "POST",
    auth: false,
    body: { token },
  });
}
