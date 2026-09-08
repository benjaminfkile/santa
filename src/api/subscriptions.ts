// docs/site.md sections 13 and 12. Alerts subscription API wrappers.

import { api } from "./client";
import type { components } from "../contracts";

export type Me = components["schemas"]["MeResponse"];
export type Subscription = components["schemas"]["SubscriptionDto"];
export type Subscriptions = components["schemas"]["ItemsResponseOfSubscriptionDto"];

export function getMe(): Promise<Me> {
  return api<Me>("/me", { method: "GET", auth: true });
}

export function listMySubscriptions(): Promise<Subscriptions> {
  return api<Subscriptions>("/me/subscriptions", { method: "GET", auth: true });
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
