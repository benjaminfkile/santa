// docs/site.md sections 10 and 12. Cookie control API wrappers.

import { api } from "./client";
import type { components } from "../contracts";

export type MyCookies = components["schemas"]["MyCookiesResponse"];
export type CreateCookieResponse = components["schemas"]["CreateCookieResponse"];

export function getMyCookies(): Promise<MyCookies> {
  return api<MyCookies>("/me/cookies", { method: "GET", auth: true });
}

export type CookiePick = { cookieTypeId: number; count: number };

export type LeaveCookiesBody = {
  items: CookiePick[];
  note?: string | null;
};

// The whole pick in one request (contracts 4.4): one entry per type with a
// count, one note for every cookie.
export function leaveCookies(body: LeaveCookiesBody): Promise<CreateCookieResponse> {
  return api<CreateCookieResponse>("/cookies", {
    method: "POST",
    auth: true,
    body: { items: body.items, note: body.note ?? null },
  });
}
