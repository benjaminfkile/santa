// docs/site.md section 7.7. Applies theme attributes and favicon href.

import type { ContentBundle } from "../../store/types";
import { resolveIcon } from "../primitives/resolve";

export type ApplyThemeInput = {
  theme: {
    accent: "red" | "green" | "gold" | "blue";
    surface: "night" | "snow" | "forest";
    fontPairing: "classic" | "festive" | "modern";
  };
  favicon: NonNullable<ContentBundle["content"]>["settings"]["favicon"];
  bundle: ContentBundle;
};

export function applyTheme(input: ApplyThemeInput, doc: Document = document): void {
  const html = doc.documentElement;
  html.setAttribute("data-accent", input.theme.accent);
  html.setAttribute("data-surface", input.theme.surface);
  html.setAttribute("data-fonts", input.theme.fontPairing);

  const link = ensureFaviconLink(doc);
  if (input.favicon === null) {
    link.setAttribute("href", "/favicon.svg");
    return;
  }
  const href = resolveIcon(input.bundle, input.favicon);
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
