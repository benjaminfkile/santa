// docs/site.md section 6.2.

import { LIVE_URL } from "../config/env";

export class CdnError extends Error {
  status: number;
  url: string;
  constructor(status: number, url: string) {
    super(`CDN ${status} ${url}`);
    this.name = "CdnError";
    this.status = status;
    this.url = url;
  }
}

export class SchemaVersionError extends Error {
  url: string;
  seen: unknown;
  constructor(url: string, seen: unknown) {
    super(`Unsupported schemaVersion at ${url}`);
    this.name = "SchemaVersionError";
    this.url = url;
    this.seen = seen;
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { credentials: "omit", signal: ctl.signal });
    if (!res.ok) throw new CdnError(res.status, url);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function checkSchemaVersion(obj: unknown, url: string): void {
  if (obj === null || typeof obj !== "object" || (obj as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new SchemaVersionError(url, (obj as { schemaVersion?: unknown } | null)?.schemaVersion);
  }
}

export const fetchLive = (): Promise<unknown> => fetchJson<unknown>(LIVE_URL);

export async function fetchSnapshot(url: string): Promise<unknown> {
  const obj = await fetchJson<unknown>(url);
  checkSchemaVersion(obj, url);
  return obj;
}
