// docs/site.md section 22.2. Typed wrappers for the admin endpoints
// the specs use. Every request adds the E2E admin bearer token.

import { e2eEnv } from "./env";
import { getAdminIdToken } from "./adminToken";

export type EventStatusId = 1 | 2 | 3 | 4 | 5;

export type AdminEvent = {
  id: number;
  year: number;
  name: string;
  scheduledAt: string | null;
  wentLiveAt: string | null;
  endedAt: string | null;
  statusId: EventStatusId | null;
  isCurrent: boolean;
  inheritRoute: boolean;
  routeId: number | null;
};

export type AdminMessage = {
  id: number;
  body: string;
  eventTime: string | null;
  createdAt: string;
};

export type ContactMessage = {
  id: number;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export type AdminBeacon = {
  id: number;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  healthy: boolean;
};

async function request<T>(
  method: "GET" | "POST" | "DELETE" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAdminIdToken();
  const res = await fetch(`${e2eEnv.API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    credentials: "omit",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = json && typeof json === "object" && "code" in json ? String((json as { code: unknown }).code) : "";
    throw new AdminApiError(res.status, code, `admin ${method} ${path} → ${res.status}${code ? ` ${code}` : ""}`);
  }
  return json as T;
}

export class AdminApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function getMe(): Promise<{ isAdmin: boolean }> {
  return request<{ isAdmin: boolean }>("GET", "/me");
}

export async function listEvents(): Promise<AdminEvent[]> {
  const res = await request<{ items: AdminEvent[] }>("GET", "/admin/events");
  return res.items;
}

export async function setCurrentEvent(id: number): Promise<void> {
  await request<void>("POST", `/admin/events/${id}/current`);
}

export async function setEventStatus(
  id: number,
  statusId: EventStatusId,
  opts: { notify?: boolean } = {},
): Promise<void> {
  try {
    await request<void>("POST", `/admin/events/${id}/status`, {
      statusId,
      notify: opts.notify ?? false,
    });
  } catch (err) {
    if (err instanceof AdminApiError && err.code === "event_status_unchanged") return;
    throw err;
  }
}

export async function patchEvent(
  id: number,
  patch: Partial<Pick<AdminEvent, "scheduledAt" | "wentLiveAt" | "endedAt" | "name">>,
): Promise<AdminEvent> {
  return request<AdminEvent>("PATCH", `/admin/events/${id}`, patch);
}

export async function postEventMessage(
  id: number,
  body: { body: string; eventTime: string | null; notify?: boolean },
): Promise<AdminMessage> {
  return request<AdminMessage>("POST", `/admin/events/${id}/messages`, {
    body: body.body,
    eventTime: body.eventTime,
    notify: body.notify ?? false,
  });
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const res = await request<{ items: ContactMessage[] }>("GET", "/admin/contact-messages");
  return res.items;
}

export async function deleteContactMessage(id: number): Promise<void> {
  await request<void>("DELETE", `/admin/contact-messages/${id}`);
}

export async function getAdminSnapshot(): Promise<{ url: string }> {
  return request<{ url: string }>("GET", "/admin/snapshot");
}

export async function mintPreviewToken(page: string): Promise<{ token: string }> {
  return request<{ token: string }>("POST", "/admin/content/preview-token", { page });
}

export async function listBeacons(): Promise<AdminBeacon[]> {
  const res = await request<{ items: AdminBeacon[] }>("GET", "/admin/beacons");
  return res.items;
}

export async function activateBeacon(id: number): Promise<void> {
  await request<void>("POST", `/admin/beacons/${id}/activate`);
}

export type CreatedBeacon = {
  beacon: AdminBeacon;
  key: string;
  enrollment: { token: string; url: string; qrPngDataUrl: string; expiresAt: string };
};

export async function createBeacon(body: { name: string; notes?: string }): Promise<CreatedBeacon> {
  return request<CreatedBeacon>("POST", "/admin/beacons", {
    name: body.name,
    notes: body.notes ?? "",
  });
}

export async function revokeBeacon(id: number): Promise<void> {
  await request<void>("POST", `/admin/beacons/${id}/revoke`);
}

export type EnrolledBeacon = {
  beaconId: number;
  name: string;
  key: string;
  apiBaseUrl: string;
  hubUrl: string;
  ingestChannel: string;
  serverTime: string;
};

export async function enrollBeacon(token: string): Promise<EnrolledBeacon> {
  const res = await fetch(`${e2eEnv.API_BASE_URL}/beacons/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ token }),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = json && typeof json === "object" && "code" in json ? String((json as { code: unknown }).code) : "";
    throw new AdminApiError(res.status, code, `POST /beacons/enroll → ${res.status}${code ? ` ${code}` : ""}`);
  }
  return json as EnrolledBeacon;
}

export async function createEvent(body: {
  year: number;
  name: string;
  scheduledAt?: string | null;
  fundsPercent?: number;
  routeId?: number | null;
  inheritRoute?: boolean;
}): Promise<AdminEvent> {
  return request<AdminEvent>("POST", "/admin/events", {
    year: body.year,
    name: body.name,
    scheduledAt: body.scheduledAt ?? null,
    fundsPercent: body.fundsPercent ?? 0,
    routeId: body.routeId ?? null,
    inheritRoute: body.inheritRoute ?? true,
  });
}

export type AdminQrCode = {
  id: number;
  tag: string;
  active?: boolean;
  opens?: { kind: string; slug: string | null };
  scans?: { people?: number };
};

export async function listQrCodes(): Promise<AdminQrCode[]> {
  const res = await request<{ items: AdminQrCode[] }>("GET", "/admin/qr-codes");
  return res.items;
}

export async function getQrCodeDetail(id: number): Promise<AdminQrCode & { scans: { people: number } }> {
  return request<AdminQrCode & { scans: { people: number } }>("GET", `/admin/qr-codes/${id}`);
}
