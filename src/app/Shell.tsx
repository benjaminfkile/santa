// docs/site.md section 7.7. Wraps every route: skip link, header with
// menu button, nav panel (focus-trap and Escape), banners, footer, and
// the map-page collapse for the live screen.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../store/useStore";
import { selectBundle, selectHome } from "../content/selectPage";
import { buildNav, type NavEntry } from "../content/nav";
import { firstSectionKind } from "../content/PageRenderer";
import { copy } from "../copy/copy";
import { ReloadPrompt } from "../pages/ReloadPrompt";
import { ContentLink } from "../content/primitives/LinkView";
import { Icon } from "../content/primitives/Icon";
import { useAuth } from "../auth/AuthProvider";
import type { ContentBundle } from "../store/types";

export type ShellProps = { children: ReactNode };

export function Shell({ children }: ShellProps) {
  const schemaMismatch = useStore((s) => s.schemaMismatch);
  const online = useStore((s) => s.diag.online);
  const consecutiveFailures = useStore((s) => s.diag.consecutivePollFailures);
  const preview = useStore((s) => s.preview);
  const bundle = useStore(selectBundle);
  const homeSurface = useStore(selectHome);
  const location = useLocation();

  const updatesPaused = !online || consecutiveFailures >= 3;
  const isMapCollapsed =
    location.pathname === "/" &&
    homeSurface.kind === "page" &&
    firstSectionKind(homeSurface.page) === "map";

  if (schemaMismatch) return <ReloadPrompt />;

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header collapsed={isMapCollapsed} bundle={bundle} />
      <Banners updatesPaused={updatesPaused} previewActive={preview !== null} />
      {children}
      {!isMapCollapsed ? <Footer bundle={bundle} /> : null}
    </>
  );
}

function Header({ collapsed, bundle }: { collapsed: boolean; bundle: ContentBundle | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const settings = bundle?.content?.settings ?? null;
  const { state: authState, signIn, signOut } = useAuth();
  const location = useLocation();

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (panel === null) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a, button, input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'a, button, input, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const entries: NavEntry[] = bundle?.content
    ? buildNav(bundle.content, {
        signedIn: authState.status === "signedIn",
        signInLabel: copy.signIn.button,
        signOutLabel: copy.signIn.signOut,
      })
    : [];

  return (
    <header className={collapsed ? "site-header site-header--collapsed" : "site-header"}>
      {!collapsed && settings ? (
        <Link to="/" className="site-header__brand">
          {settings.logo !== null && bundle !== null ? (
            <Icon icon={settings.logo} bundle={bundle} alt="" decorative />
          ) : null}
          <span>{settings.siteName}</span>
        </Link>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Menu"
        className="site-header__menu-button"
        onClick={() => setOpen((v) => !v)}
      >
        Menu
      </button>
      <nav
        id={panelId}
        ref={(el) => {
          panelRef.current = el;
        }}
        aria-label="Site"
        hidden={!open}
        className="site-header__nav"
      >
        <ul>
          {entries.map((entry, i) => (
            <li key={i}>
              {renderEntry(entry, bundle, {
                onSignIn: () => void signIn(location.pathname + location.search),
                onSignOut: () => void signOut(),
              })}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function renderEntry(
  entry: NavEntry,
  bundle: ContentBundle | null,
  actions: { onSignIn: () => void; onSignOut: () => void },
) {
  if (entry.kind === "home") return <Link to="/">{entry.label}</Link>;
  if (entry.kind === "page") return <Link to={entry.href}>{entry.label}</Link>;
  if (entry.kind === "extra") {
    return bundle !== null ? <ContentLink link={entry.link} bundle={bundle} /> : null;
  }
  return (
    <button
      type="button"
      className="site-header__auth-button"
      onClick={entry.kind === "signIn" ? actions.onSignIn : actions.onSignOut}
      data-testid={entry.kind === "signIn" ? "menu-sign-in" : undefined}
    >
      {entry.label}
    </button>
  );
}

function Banners({
  updatesPaused,
  previewActive,
}: {
  updatesPaused: boolean;
  previewActive: boolean;
}) {
  if (!updatesPaused && !previewActive) return null;
  return (
    <div className="site-banners" role="status">
      {updatesPaused ? (
        <div className="site-banner site-banner--updates-paused">
          {copy.banners.updatesPaused}
        </div>
      ) : null}
      {previewActive ? (
        <div className="site-banner site-banner--preview" data-testid="preview-banner">
          {copy.banners.preview}
        </div>
      ) : null}
    </div>
  );
}

function Footer({ bundle }: { bundle: ContentBundle | null }) {
  const settings = bundle?.content?.settings ?? null;
  if (settings === null || bundle === null) return null;
  return (
    <footer className="site-footer">
      {settings.footerLinks.length > 0 ? (
        <ul className="site-footer__links">
          {settings.footerLinks.map((link, i) => (
            <li key={i}>
              <ContentLink link={link} bundle={bundle} />
            </li>
          ))}
        </ul>
      ) : null}
      {settings.footerText !== null ? (
        <p className="site-footer__text">{settings.footerText}</p>
      ) : null}
    </footer>
  );
}
