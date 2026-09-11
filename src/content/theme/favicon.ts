// docs/site.md section 7.7. settings.favicon replaces the <link rel="icon">
// href with the resolved icon URL when set; the default falls back to
// /favicon.svg whenever the bundle changes.

import type { ContentBundle } from "../../store/types";
import type { SiteSettings } from "../../contracts";
import { resolveIcon } from "../primitives/resolve";

export function applyFavicon(
  favicon: SiteSettings["favicon"],
  bundle: ContentBundle,
  doc: Document = document,
): void {
  const link = ensureFaviconLink(doc);
  if (favicon === null) {
    link.setAttribute("href", "/favicon.svg");
    return;
  }
  const href = resolveIcon(bundle, favicon);
  link.setAttribute("href", href ?? "/favicon.svg");
}

function ensureFaviconLink(doc: Document): HTMLLinkElement {
  let link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link === null) {
    link = doc.createElement("link");
    link.setAttribute("rel", "icon");
    doc.head.appendChild(link);
  }
  return link;
}
