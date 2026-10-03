// docs/site.md section 4 and 7.7. Nav entries computed from the content
// document. Each entry carries the icon the menu panel draws in its row:
// a page's own `icon`, the home entry's the icon of the role page served
// at `/`, a nav extra link's through its `link.icon`, and the sign in and
// sign out entries a bundled library icon.

import type { ContentDocument, IconRef, Link, PageRole } from "../contracts";

export type NavEntry =
  | { kind: "home"; label: string; href: "/"; icon: IconRef | null }
  | { kind: "page"; label: string; href: string; icon: IconRef | null }
  | { kind: "extra"; link: Link }
  | { kind: "signIn"; label: string; icon: IconRef }
  | { kind: "signOut"; label: string; icon: IconRef };

export type NavOptions = {
  signedIn: boolean;
  signInLabel: string;
  signOutLabel: string;
  // The role of the page served at `/` right now, whose icon the home
  // entry takes; null or absent leaves the home entry without one.
  homeRole?: PageRole | null;
};

// The library icons of the account entries: a name tag to sign in, a
// waving mitten to sign out.
export const SIGN_IN_ICON: IconRef = { source: "library", id: "gift-tag" };
export const SIGN_OUT_ICON: IconRef = { source: "library", id: "mitten" };

export function buildNav(content: ContentDocument, opts: NavOptions): NavEntry[] {
  const homeRole = opts.homeRole ?? null;
  const homePage =
    homeRole !== null ? content.pages.find((p) => p.role === homeRole) ?? null : null;
  const entries: NavEntry[] = [
    {
      kind: "home",
      label: content.settings.homeNavLabel,
      href: "/",
      icon: homePage?.icon ?? null,
    },
  ];

  const pages = content.pages
    .filter((p) => p.role === "none" && p.navLabel !== null && p.navLabel !== "")
    .slice()
    .sort((a, b) => a.navPosition - b.navPosition || a.id - b.id);

  for (const p of pages) {
    entries.push({ kind: "page", label: p.navLabel as string, href: `/${p.slug}`, icon: p.icon ?? null });
  }

  for (const link of content.settings.navExtraLinks) {
    entries.push({ kind: "extra", link });
  }

  entries.push(
    opts.signedIn
      ? { kind: "signOut", label: opts.signOutLabel, icon: SIGN_OUT_ICON }
      : { kind: "signIn", label: opts.signInLabel, icon: SIGN_IN_ICON },
  );

  return entries;
}

// The page the alerts dialog's Manage alerts link opens: the first page in
// the document carrying an `alerts_signup` section that a visitor can
// reach now (a page without a role at `/<slug>`, or the role page served
// at `/`). Null when there is none.
export function alertsPageHref(content: ContentDocument, homeRole: PageRole | null): string | null {
  for (const p of content.pages) {
    if (!p.sections.some((s) => s.kind === "alerts_signup")) continue;
    if (p.role === "none") return `/${p.slug}`;
    if (homeRole !== null && p.role === homeRole) return "/";
  }
  return null;
}
