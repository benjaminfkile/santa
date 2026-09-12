// docs/site.md section 5.4. Pure page-selection functions.

import type { ContentDocument, ContentPage, PageRole } from "../contracts";
import type { ContentBundle, SiteStore } from "../store/types";

export type Surface =
  | { kind: "loading" }
  | { kind: "reload" }
  | { kind: "page"; page: ContentPage }
  | { kind: "notFound" }
  | { kind: "redirectHome" };

const ROLE_BY_STATUS: Record<number, PageRole> = {
  1: "planned",
  2: "scheduled",
  3: "live",
  4: "ended",
  5: "cancelled",
};

export function selectBundle(s: SiteStore): ContentBundle | null {
  if (s.preview) return s.preview;
  if (!s.snapshot) return null;
  return {
    content: (s.snapshot.content ?? null) as ContentDocument,
    media: s.snapshot.media ?? {},
    icons: s.snapshot.icons ?? {},
  };
}

export function selectRole(s: SiteStore): PageRole | null {
  if (s.live === null) return null;
  const id = s.live.eventStatusId ?? null;
  if (id === null) return "no_event";
  return ROLE_BY_STATUS[id] ?? null;
}

export function selectHome(s: SiteStore): Surface {
  if (s.schemaMismatch) return { kind: "reload" };
  const role = selectRole(s);
  const bundle = selectBundle(s);
  if (s.live === null || bundle === null || bundle.content === null) {
    return { kind: "loading" };
  }
  if (role === null) return { kind: "reload" };
  const page = bundle.content.pages.find((p) => p.role === role);
  return page ? { kind: "page", page } : { kind: "reload" };
}

export function selectSlug(s: SiteStore, slug: string): Surface {
  if (s.schemaMismatch) return { kind: "reload" };
  const bundle = selectBundle(s);
  if (bundle === null || bundle.content === null) return { kind: "loading" };
  const page = bundle.content.pages.find((p) => p.slug === slug);
  if (!page) return { kind: "notFound" };
  return page.role === "none" ? { kind: "page", page } : { kind: "redirectHome" };
}

// Two surfaces are the same when their kind and their page (by identity,
// which the store keeps stable across live polls) match. useStore callers
// pass this so a poll never re-renders a page whose document is unchanged.
export function surfaceEqual(a: Surface, b: Surface): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "page" && b.kind === "page") return a.page === b.page;
  return true;
}

// The live takeover: while the event is live and no preview is loaded,
// every path renders the tracker alone (docs 7.6, 24).
export function selectTakeover(s: SiteStore): boolean {
  return s.live?.eventStatusId === 3 && s.preview === null;
}
