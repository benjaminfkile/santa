// docs/site.md sections 10 and 12. Cookie control API wrappers.

import { api } from "./client";
import type { components } from "../contracts";

export type MyCookies = components["schemas"]["MyCookiesResponse"];
export type CreateCookieResponse = components["schemas"]["CreateCookieResponse"];

export function getMyCookies(): Promise<MyCookies> {
  return api<MyCookies>("/me/cookies", { method: "GET", auth: true });
}

export type LeaveCookieBody = {
  cookieTypeId: number;
  note?: string | null;
};

export function leaveCookie(body: LeaveCookieBody): Promise<CreateCookieResponse> {
  return api<CreateCookieResponse>("/cookies", {
    method: "POST",
    auth: true,
    body: { cookieTypeId: body.cookieTypeId, note: body.note ?? null },
  });
}
