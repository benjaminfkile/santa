// docs/site.md section 12. Fetch wrapper: bearer, error shape, timeouts.
// Callers switch on `body.code`; `body.message` is never rendered.
// docs/site.md 11.4: a 401 from the API triggers one refresh and one retry,
// then SignInRequired.

import { env } from "../config/env";
import type { ApiError } from "../contracts";
import { getIdToken, refreshNow, SignInRequired } from "../auth/session";

export type { ApiError };
export { SignInRequired };

export class ApiRequestError extends Error {
  status: number;
  body: ApiError | null;
  retryAfterSeconds: number | null;
  constructor(status: number, body: ApiError | null, retryAfterSeconds: number | null) {
    super(body?.code ?? `http_${status}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  get code(): string {
    return this.body?.code ?? `http_${this.status}`;
  }
}

export type ApiMethod = "GET" | "POST" | "DELETE";

export type ApiOpts = {
  method: ApiMethod;
  body?: unknown;
  auth: boolean;
  timeoutMs?: number;
};

export async function api<T>(path: string, opts: ApiOpts): Promise<T> {
  const bearer = opts.auth ? await getIdToken() : null;
  try {
    return await doFetch<T>(path, opts, bearer);
  } catch (e) {
    if (
      opts.auth &&
      e instanceof ApiRequestError &&
      e.status === 401 &&
      bearer !== null
    ) {
      const next = await refreshNow();
      return await doFetch<T>(path, opts, next);
    }
    throw e;
  }
}

async function doFetch<T>(path: string, opts: ApiOpts, bearer: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (bearer !== null) headers["Authorization"] = `Bearer ${bearer}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(`${env.API_BASE_URL}${path}`, {
      method: opts.method,
      headers,
      credentials: "omit",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctl.signal,
    });
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    const json = ct.includes("application/json") ? await res.json() : null;
    if (!res.ok) {
      const ra = res.headers.get("Retry-After");
      const retryAfter =
        ra !== null && ra !== "" && !Number.isNaN(Number(ra))
          ? Number(ra)
          : readRetryAfterFromDetails(json);
      throw new ApiRequestError(res.status, (json ?? null) as ApiError | null, retryAfter);
    }
    return json as T;
  } finally {
    clearTimeout(t);
  }
}

function readRetryAfterFromDetails(json: unknown): number | null {
  if (json === null || typeof json !== "object") return null;
  const details = (json as { details?: unknown }).details;
  if (details === null || typeof details !== "object") return null;
  const v = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
