// docs/site.md section 7.8. Preview bundle fetch. Direct fetch (no bearer,
// no bundle cache) because the client wrapper always appends
// $API_BASE_URL/<path> and never adds a query string. This is the one
// CDN-free read on the site.

import { env } from "../config/env";
import { ApiRequestError } from "./client";
import type { ApiError, ContentDocument, Snapshot } from "../contracts";

export type PreviewBundle = {
  content: ContentDocument;
  media: NonNullable<Snapshot["media"]>;
  icons: NonNullable<Snapshot["icons"]>;
};

export async function fetchPreviewBundle(
  token: string,
  timeoutMs = 15000,
): Promise<PreviewBundle> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const url = `${env.API_BASE_URL}/preview/document?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "omit",
      signal: ctl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    const json = ct.includes("application/json") ? await res.json() : null;
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
    return {
      content: (data.content ?? null) as ContentDocument,
      media: (data.media ?? {}) as PreviewBundle["media"],
      icons: (data.icons ?? {}) as PreviewBundle["icons"],
    };
  } finally {
    clearTimeout(t);
  }
}
