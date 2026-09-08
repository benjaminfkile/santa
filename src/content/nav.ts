// docs/site.md section 4. Nav entries computed from the content document.

import type { ContentDocument, Link } from "../contracts";

export type NavEntry =
  | { kind: "home"; label: string; href: "/" }
  | { kind: "page"; label: string; href: string }
  | { kind: "extra"; link: Link }
  | { kind: "signIn"; label: string }
  | { kind: "signOut"; label: string };

export type NavOptions = {
  signedIn: boolean;
  signInLabel: string;
  signOutLabel: string;
};

export function buildNav(content: ContentDocument, opts: NavOptions): NavEntry[] {
  const entries: NavEntry[] = [
    { kind: "home", label: content.settings.homeNavLabel, href: "/" },
  ];

  const pages = content.pages
    .filter((p) => p.role === "none" && p.navLabel !== null && p.navLabel !== "")
    .slice()
    .sort((a, b) => a.navPosition - b.navPosition || a.id - b.id);

  for (const p of pages) {
    entries.push({ kind: "page", label: p.navLabel as string, href: `/${p.slug}` });
  }

  for (const link of content.settings.navExtraLinks) {
    entries.push({ kind: "extra", link });
  }

  entries.push(
    opts.signedIn
      ? { kind: "signOut", label: opts.signOutLabel }
      : { kind: "signIn", label: opts.signInLabel },
  );

  return entries;
}
