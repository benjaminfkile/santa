// docs/site.md section 12. Fetch wrapper: bearer, error shape, timeouts.
// Callers switch on `body.code`; `body.message` is never rendered.
// docs/site.md 11.4: a 401 from the API triggers one refresh and one retry,
// then SignInRequired. A `403 blocked` clears the session with no refresh
// and throws SignInRequired("blocked") (site.md 11.4, 19).

import { env } from "../config/env";
import type { ApiError } from "../contracts";
import { getIdToken, refreshNow, session, SignInRequired } from "../auth/session";

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

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

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
    if (bearer === null || !(e instanceof ApiRequestError)) throw e;
    if (isBlocked(e)) throw endBlocked();
    if (e.status !== 401) throw e;
  }
  // One refresh and one retry; a second 401 (an `unknown_user` token the
  // refresh did not mend) ends the session too.
  const next = await refreshNow();
  try {
    return await doFetch<T>(path, opts, next);
  } catch (e) {
    if (!(e instanceof ApiRequestError)) throw e;
    if (isBlocked(e)) throw endBlocked();
    if (e.status === 401) {
      session.clear();
      throw new SignInRequired();
    }
    throw e;
  }
}

function isBlocked(e: ApiRequestError): boolean {
  return e.status === 403 && e.body?.code === "blocked";
}

function endBlocked(): SignInRequired {
  session.block();
  return new SignInRequired("blocked");
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
