// docs/site.md section 7.8. Preview bundle fetch. Direct fetch (no bearer,
// no bundle cache) because the client wrapper always appends
// $API_BASE_URL/<path> and never adds a query string. This is the one
// CDN-free read on the site. The caller passes the last ETag it saw; the
// request carries it as If-None-Match, and a 304 comes back as
// "not-modified". A 200 returns the body text so the caller can tell an
// unchanged draft from a changed one.

import { env } from "../config/env";
import { ApiRequestError } from "./client";
import type { ApiError, ContentDocument, Snapshot } from "../contracts";

export type PreviewBundle = {
  content: ContentDocument;
  media: NonNullable<Snapshot["media"]>;
  icons: NonNullable<Snapshot["icons"]>;
};

export type PreviewFetchResult =
  | { kind: "not-modified" }
  | { kind: "ok"; bundle: PreviewBundle; text: string; etag: string | null };

export async function fetchPreviewDocument(
  token: string,
  etag: string | null,
  timeoutMs = 15000,
): Promise<PreviewFetchResult> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const url = `${env.API_BASE_URL}/preview/document?token=${encodeURIComponent(token)}`;
    const headers: Record<string, string> = {};
    if (etag !== null && etag !== "") headers["If-None-Match"] = etag;
    const res = await fetch(url, {
      method: "GET",
      credentials: "omit",
      headers,
      signal: ctl.signal,
    });
    if (res.status === 304) return { kind: "not-modified" };
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    const json = ct.includes("application/json") && text !== "" ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const ra = res.headers.get("Retry-After");
      const retryAfter =
        ra !== null && ra !== "" && !Number.isNaN(Number(ra)) ? Number(ra) : null;
      throw new ApiRequestError(res.status, (json ?? null) as ApiError | null, retryAfter);
    }
    const data = (json ?? {}) as {
      content?: unknown;
      media?: Record<string, unknown>;
      icons?: Record<string, string>;
    };
    const nextEtag = res.headers.get("ETag");
    return {
      kind: "ok",
      bundle: {
        content: (data.content ?? null) as ContentDocument,
        media: (data.media ?? {}) as PreviewBundle["media"],
        icons: (data.icons ?? {}) as PreviewBundle["icons"],
      },
      text,
      etag: nextEtag !== null && nextEtag !== "" ? nextEtag : null,
    };
  } finally {
    clearTimeout(t);
  }
}
