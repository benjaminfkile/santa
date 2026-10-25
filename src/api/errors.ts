// docs/site.md section 12. Maps every API `code` the site can meet to
// site-coded copy; `body.message` is never rendered.

import { ApiRequestError, SignInRequired } from "./client";
import { copy } from "../copy/copy";

export type ErrorSurface = {
  code: string;
  message: string;
  retryAfterSeconds: number | null;
  fieldErrors: Record<string, string>;
};

const GENERIC = "Something went wrong. Please try again.";

const COPY_BY_CODE: Record<string, string> = {
  unauthenticated: "Please sign in again.",
  forbidden: "You do not have permission to do that.",
  not_found: "That is no longer available.",
  validation_failed: "Please check the highlighted fields.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  cookie_limit_reached: "You have left all your cookies for this year.",
  no_live_event: "The event is not live right now.",
  address_taken: "That address is attached to a different account.",
  already_subscribed: "You are already receiving alerts at that address.",
  already_verified: "That address has already been confirmed.",
  subscriptions_closed: "New alert sign-ups are closed for now.",
  invalid_token: "This link is not valid.",
  expired_token: "This link has expired.",
  contact_disabled: "The contact form is closed right now.",
};

export function copyForCode(code: string): string {
  return COPY_BY_CODE[code] ?? GENERIC;
}

export function fieldErrorsFrom(err: ApiRequestError): Record<string, string> {
  const details = err.body?.details ?? null;
  if (details === null) return {};
  const fields = (details as { fields?: unknown }).fields;
  if (fields === null || typeof fields !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    if (typeof v === "string") {
      out[k] = v;
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
      out[k] = v[0];
    }
  }
  return out;
}

export function surfaceFor(err: unknown): ErrorSurface {
  if (err instanceof SignInRequired) {
    // Still "unauthenticated" so callers take the sign-in path; a blocked
    // account reads the blocked notice (site.md 19).
    const message = err.reason === "blocked" ? copy.auth.blocked : COPY_BY_CODE.unauthenticated;
    return { code: "unauthenticated", message, retryAfterSeconds: null, fieldErrors: {} };
  }
  if (err instanceof ApiRequestError) {
    const code = err.code;
    return {
      code,
      message: copyForCode(code),
      retryAfterSeconds: err.retryAfterSeconds,
      fieldErrors: fieldErrorsFrom(err),
    };
  }
  return { code: "network", message: GENERIC, retryAfterSeconds: null, fieldErrors: {} };
}

export { ApiRequestError, SignInRequired };
