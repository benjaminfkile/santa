// docs/site.md section 7.7. Wraps every route: skip link, header with
// brand, sign-in, theme toggle and menu, nav drawer, banners, footer, and
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
import { useAuth } from "../auth/AuthProvider";
import { useThemeChoice } from "../content/theme/colorScheme";
import type { ContentBundle } from "../store/types";
import * as styles from "./Shell.module.css";

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

  const returnTo = location.pathname + location.search;
  const onSignInClick = useCallback(() => void signIn(returnTo), [signIn, returnTo]);

  return (
    <header
      className={collapsed ? "site-header site-header--collapsed" : "site-header"}
      data-testid="site-header"
    >
      {!collapsed && settings ? (
        <Link to="/" className={`site-header__brand ${styles.brand}`}>
          <BrandMark />
          <span>{settings.siteName}</span>
        </Link>
      ) : null}
      {!collapsed && entries.length > 0 ? (
        <nav aria-label="Pages" className="site-header__inline-nav">
          <ul>
            {entries
              .filter((entry) => entry.kind === "home" || entry.kind === "page" || entry.kind === "extra")
              .map((entry, i) => (
                <li key={i}>
                  {renderEntry(entry, bundle, {
                    onSignIn: onSignInClick,
                    onSignOut: () => void signOut(),
                  })}
                </li>
              ))}
          </ul>
        </nav>
      ) : null}
      <div className="site-header__actions">
        {!collapsed && authState.status !== "signedIn" ? (
          <button
            type="button"
            className="site-header__sign-in"
            onClick={onSignInClick}
          >
            {copy.signIn.button}
          </button>
        ) : null}
        {!collapsed ? <ThemeToggle /> : null}
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="Menu"
          className="site-header__menu-button"
          onClick={() => setOpen((v) => !v)}
        >
          <MenuGlyph />
        </button>
      </div>
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
                onSignIn: onSignInClick,
                onSignOut: () => void signOut(),
              })}
            </li>
          ))}
          <li>
            <FollowSystemButton />
          </li>
        </ul>
      </nav>
    </header>
  );
}

function BrandMark() {
  // Montana silhouette with a gold star at Missoula. Inline SVG so the
  // outline follows --accent and the star follows --gold.
  return (
    <svg
      viewBox="0 0 100 60"
      className={styles.brandMark}
      role="img"
      aria-label="WMSFO"
      focusable={false}
    >
      <path
        d="M2 2 L98 2 L98 42 L60 42 L58 52 L48 50 L44 58 L34 52 L18 50 L14 42 L2 42 Z"
        fill="var(--panel-2)"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M28 22 L30.5 27.5 L36.5 28 L32 32 L33.2 38 L28 34.8 L22.8 38 L24 32 L19.5 28 L25.5 27.5 Z"
        className={styles.brandStar}
      />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolved, setLight, setDark } = useThemeChoice();
  const nextIsLight = resolved === "dark";
  const label = nextIsLight ? "Switch to light mode" : "Switch to dark mode";
  const onClick = nextIsLight ? setLight : setDark;
  return (
    <button
      type="button"
      className={`site-header__theme-toggle ${styles.themeToggle}`}
      aria-label={label}
      data-testid="theme-toggle"
      onClick={onClick}
    >
      {nextIsLight ? <SunGlyph /> : <MoonGlyph />}
    </button>
  );
}

function FollowSystemButton() {
  const { choice, followSystem } = useThemeChoice();
  return (
    <button
      type="button"
      className={`site-header__system-button ${styles.systemButton} ${choice === "system" ? styles.systemButtonActive : ""}`}
      data-testid="follow-system"
      onClick={followSystem}
    >
      {copy.theme.followSystem}
    </button>
  );
}

function SunGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
      <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.7A9 9 0 0 1 11.3 3 A7 7 0 1 0 21 12.7 Z" />
    </svg>
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
    <footer className="site-footer" data-testid="site-footer">
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
