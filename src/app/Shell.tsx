// docs/site.md section 7.7. Wraps every route: skip link, header with
// brand (the site logo or the built-in mark), sign-in, the alerts bell,
// theme toggle and menu, the menu panel, banners, footer. The header is
// sticky at the top of the viewport. The menu panel sits in the top right corner over the menu
// button, which hides while the panel is open; the panel slides in from the
// right on open and out to the right on close (instant under reduced
// motion), and a press outside it, the choice of any row, or Escape closes
// it and returns focus to the menu button. Crossing into the desktop
// breakpoint (wider than 760 px) closes the panel at once, with no slide,
// and releases everything an open panel holds: the focus trap, the
// outside press listeners, and the hidden menu button.
// While the event is live the shell steps aside: the live screen owns the
// viewport and nothing else on the site renders or scrolls.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../store/useStore";
import { selectBundle, selectRole, selectTakeover } from "../content/selectPage";
import { buildNav, type NavEntry } from "../content/nav";
import { copy } from "../copy/copy";
import { ReloadPrompt } from "../pages/ReloadPrompt";
import { ContentLink, LinkView } from "../content/primitives/LinkView";
import { Icon } from "../content/primitives/Icon";
import { Logo } from "../content/Logo";
import { useAuth } from "../auth/AuthProvider";
import { useThemeChoice } from "../content/theme/colorScheme";
import { LightsLayer } from "../content/theme/seasonalLayers";
import { useReducedMotion } from "../lib/motion";
import type { IconRef } from "../contracts";
import type { ContentBundle } from "../store/types";
import { usePreviewLive } from "../pages/previewLive";
import {
  endPreviewSession,
  usePreviewSession,
  type PreviewSessionState,
} from "../pages/previewSession";
import { formatClock } from "../lib/time";
import { PriorityNav } from "./PriorityNav";
import { AlertsBell } from "../alerts/AlertsBell";
import * as styles from "./Shell.module.css";

export type ShellProps = { children: ReactNode };

export function Shell({ children }: ShellProps) {
  const schemaMismatch = useStore((s) => s.schemaMismatch);
  const online = useStore((s) => s.diag.online);
  const consecutiveFailures = useStore((s) => s.diag.consecutivePollFailures);
  const preview = useStore((s) => s.preview);
  const session = usePreviewSession();
  const bundle = useStore(selectBundle, bundleEqual);
  const takeover = useStore(selectTakeover);

  const updatesPaused = !online || consecutiveFailures >= 3;

  useEffect(() => {
    const root = document.documentElement;
    if (takeover) root.setAttribute("data-takeover", "live");
    else root.removeAttribute("data-takeover");
    return () => root.removeAttribute("data-takeover");
  }, [takeover]);

  if (schemaMismatch) return <ReloadPrompt />;

  if (takeover) {
    // The tracker owns the whole viewport; a preview session keeps its
    // banner floating over it so Exit preview stays reachable.
    const previewActive = preview !== null || session !== null;
    return (
      <>
        {previewActive ? (
          <div className={styles.takeoverBanners}>
            <Banners updatesPaused={false} previewActive session={session} />
          </div>
        ) : null}
        {children}
      </>
    );
  }

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <Header bundle={bundle} />
      <Banners
        updatesPaused={updatesPaused}
        previewActive={preview !== null || session !== null}
        session={session}
      />
      {children}
      <Footer bundle={bundle} />
    </>
  );
}

function bundleEqual(a: ContentBundle | null, b: ContentBundle | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.content === b.content && a.media === b.media && a.icons === b.icons;
}

// The panel's phases: closed (hidden), open (sliding in from the right or
// at rest), closing (sliding out to the right, then closed).
type PanelPhase = "closed" | "open" | "closing";

// The close slide's length in ms; matches `panelOut` in Shell.module.css.
// A timer ends the phase in case `animationend` never fires.
const PANEL_CLOSE_MS = 500;

// The desktop breakpoint: the inline nav shows and the menu button hides
// (Shell.module.css, `max-width: 760px`).
const DESKTOP_QUERY = "(min-width: 761px)";

function Header({ bundle }: { bundle: ContentBundle | null }) {
  const [phase, setPhase] = useState<PanelPhase>("closed");
  const open = phase === "open";
  const reducedMotion = useReducedMotion();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  // Set when a close should hand focus back to the menu button; the button
  // is hidden while the panel is open, so focus moves once it shows again.
  const restoreFocusRef = useRef(false);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (el === null) return;
    const root = document.documentElement;
    const write = (height: number): void => {
      root.style.setProperty("--header-height", `${Math.round(height)}px`);
    };
    write(el.getBoundingClientRect().height);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) write(entry.contentRect.height);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--header-height");
    };
  }, []);
  const settings = bundle?.content?.settings ?? null;
  // With a logo image the brand link shows the logo, then the site name
  // unless `headerShowsSiteName` is false; the link keeps the site name as
  // its accessible name either way. Without one it shows BrandMark and name.
  const hasLogo = (settings?.logoMedia ?? null) !== null;
  const showName = !hasLogo || settings?.headerShowsSiteName !== false;
  const { state: authState, signIn, signOut } = useAuth();
  const homeRole = useStore(selectRole);
  const location = useLocation();

  const finishClose = useCallback(() => {
    setPhase((p) => (p === "closing" ? "closed" : p));
  }, []);

  const dismiss = useCallback(() => {
    setPhase((p) => (p === "open" ? (reducedMotion ? "closed" : "closing") : p));
  }, [reducedMotion]);

  const close = useCallback(() => {
    restoreFocusRef.current = true;
    dismiss();
  }, [dismiss]);

  useLayoutEffect(() => {
    if (phase === "open" || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    buttonRef.current?.focus();
  }, [phase]);

  // While the panel is open or closing, crossing into the desktop
  // breakpoint closes it immediately: no exit slide, and no focus hand
  // back, since the menu button is not displayed there.
  useEffect(() => {
    if (phase === "closed") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const closeNow = (): void => {
      restoreFocusRef.current = false;
      setPhase("closed");
    };
    if (mq.matches) {
      closeNow();
      return;
    }
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) closeNow();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const panel = panelRef.current;
    function onEnd(e: Event) {
      if (e.target === panel) finishClose();
    }
    panel?.addEventListener("animationend", onEnd);
    const t = window.setTimeout(finishClose, PANEL_CLOSE_MS + 50);
    return () => {
      panel?.removeEventListener("animationend", onEnd);
      window.clearTimeout(t);
    };
  }, [phase, finishClose]);

  // A pointer press outside the panel and its button closes it and returns
  // focus to the button. The touch listener is passive: it never cancels
  // the touch or the scroll.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent | MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (target === null) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open, close]);

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
        homeRole,
      })
    : [];

  const returnTo = location.pathname + location.search;
  const onSignInClick = useCallback(() => void signIn(returnTo), [signIn, returnTo]);

  return (
    <header
      ref={headerRef}
      className={styles.siteHeader}
      data-testid="site-header"
    >
      {settings ? (
        <Link
          to="/"
          className={styles.brand}
          aria-label={hasLogo && !showName ? settings.siteName : undefined}
        >
          {hasLogo && bundle !== null ? (
            <Logo bundle={bundle} className={styles.brandLogo} testId="brand-logo" />
          ) : (
            <BrandMark />
          )}
          {showName ? <span>{settings.siteName}</span> : null}
        </Link>
      ) : null}
      {entries.length > 0 ? (
        <PriorityNav
          items={entries
            .filter((entry) => entry.kind === "home" || entry.kind === "page" || entry.kind === "extra")
            .map((entry, i) => ({
              key: navKey(entry, i),
              node: renderEntry(entry, bundle, {
                onSignIn: onSignInClick,
                onSignOut: () => void signOut(),
              }),
            }))}
        />
      ) : null}
      <div className={styles.actions}>
        {authState.status === "signedIn" ? (
          <button
            type="button"
            className={styles.signIn}
            data-testid="menu-sign-out"
            onClick={() => void signOut()}
          >
            {copy.signIn.signOut}
          </button>
        ) : (
          <button
            type="button"
            className={styles.signIn}
            data-testid="menu-sign-in"
            onClick={onSignInClick}
          >
            {copy.signIn.button}
          </button>
        )}
        <AlertsBell className={styles.themeToggle} />
        <ThemePicker />
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="Menu"
          className={styles.menuButton}
          data-panel-open={open ? "true" : undefined}
          onClick={() => setPhase((p) => (p === "open" ? (reducedMotion ? "closed" : "closing") : "open"))}
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
        hidden={phase === "closed"}
        data-panel={phase}
        data-motion={panelMotion(phase, reducedMotion)}
        className={panelClass(phase, reducedMotion)}
        onClick={(e) => {
          // Choosing any row (a link or a button) closes the panel as it
          // acts and returns focus to the menu button.
          const item = (e.target as Element).closest("a, button");
          if (item !== null && e.currentTarget.contains(item)) close();
        }}
      >
        <ul className={styles.panelList}>
          {entries.map((entry, i) => (
            <li key={i}>
              {renderRow(entry, bundle, {
                onSignIn: onSignInClick,
                onSignOut: () => void signOut(),
              })}
            </li>
          ))}
        </ul>
      </nav>
      <LightsLayer bundle={bundle} />
    </header>
  );
}

// The panel's slide: "in" from the right while open, "out" to the right
// while closing, "none" when closed or under reduced motion.
function panelMotion(phase: PanelPhase, reducedMotion: boolean): "in" | "out" | "none" {
  if (reducedMotion || phase === "closed") return "none";
  return phase === "open" ? "in" : "out";
}

function panelClass(phase: PanelPhase, reducedMotion: boolean): string {
  const motion = panelMotion(phase, reducedMotion);
  if (motion === "none") return styles.panel;
  return `${styles.panel} ${motion === "in" ? styles.panelIn : styles.panelOut}`;
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

// The header's theme control: a sun or moon button opening a small menu
// with Light, Dark, and System; the current choice is checked.
function ThemePicker() {
  const { choice, resolved, setLight, setDark, followSystem } = useThemeChoice();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: { key: "light" | "dark" | "system"; label: string; act: () => void }[] = [
    { key: "light", label: copy.theme.light, act: setLight },
    { key: "dark", label: copy.theme.dark, act: setDark },
    { key: "system", label: copy.theme.system, act: followSystem },
  ];

  return (
    <div className={styles.themePicker} ref={rootRef}>
      <button
        type="button"
        className={styles.themeToggle}
        aria-label={copy.theme.picker}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="theme-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {resolved === "dark" ? <MoonGlyph /> : <SunGlyph />}
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={copy.theme.picker} className={styles.themeMenu} data-testid="theme-menu">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="menuitemradio"
              aria-checked={choice === o.key}
              className={styles.themeOption}
              data-testid={`theme-${o.key}`}
              onClick={() => {
                o.act();
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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

function navKey(entry: NavEntry, index: number): string {
  if (entry.kind === "extra") return `${index}:extra:${entry.link.href}:${entry.link.label}`;
  if (entry.kind === "home" || entry.kind === "page") return `${index}:${entry.kind}:${entry.href}:${entry.label}`;
  return `${index}:${entry.kind}:${entry.label}`;
}

function renderEntry(
  entry: NavEntry,
  bundle: ContentBundle | null,
  actions: { onSignIn: () => void; onSignOut: () => void },
) {
  if (entry.kind === "home") return <Link to="/">{entry.label}</Link>;
  if (entry.kind === "page") return <Link to={entry.href}>{entry.label}</Link>;
  if (entry.kind === "extra") {
    // The inline nav and its More menu are text only: no link icon.
    return bundle !== null ? (
      <LinkView href={entry.link.href} bundle={bundle} newTab={entry.link.newTab}>
        {entry.link.label}
      </LinkView>
    ) : null;
  }
  return (
    <button
      type="button"
      className={styles.authButton}
      onClick={entry.kind === "signIn" ? actions.onSignIn : actions.onSignOut}
      data-testid={entry.kind === "signIn" ? "menu-sign-in" : undefined}
    >
      {entry.label}
    </button>
  );
}

// The panel row's icon size; matches `.rowIcon` in Shell.module.css.
const ROW_ICON_PX = 24;

// One panel row: a leading icon slot and the label, the whole row one
// tap target. The slot draws the destination's icon (a page's `icon`, the
// home page's for home, a nav extra link's `link.icon`, the bundled
// library icon of the sign in and sign out rows) at the slot's 24 px,
// without the icon's display box, so every row's icon is the same size; a
// destination without an icon, or one that resolves to nothing, leaves
// the slot empty, so every label starts at the same inset.
function renderRow(
  entry: NavEntry,
  bundle: ContentBundle | null,
  actions: { onSignIn: () => void; onSignOut: () => void },
) {
  const body = (icon: IconRef | null, label: string) => (
    <>
      <span className={styles.rowIcon} aria-hidden data-testid="panel-row-icon">
        {icon !== null && bundle !== null ? (
          <Icon icon={{ source: icon.source, id: icon.id }} bundle={bundle} alt="" decorative size={ROW_ICON_PX} />
        ) : null}
      </span>
      <span className={styles.rowLabel}>{label}</span>
    </>
  );
  if (entry.kind === "home" || entry.kind === "page") {
    return (
      <Link to={entry.href} className={styles.row}>
        {body(entry.icon, entry.label)}
      </Link>
    );
  }
  if (entry.kind === "extra") {
    if (bundle === null) return null;
    return (
      <LinkView href={entry.link.href} bundle={bundle} newTab={entry.link.newTab} className={styles.row}>
        {body(entry.link.icon, entry.link.label)}
      </LinkView>
    );
  }
  return (
    <button
      type="button"
      className={styles.row}
      onClick={entry.kind === "signIn" ? actions.onSignIn : actions.onSignOut}
      data-testid={entry.kind === "signIn" ? "menu-sign-in" : undefined}
    >
      {body(entry.icon, entry.label)}
    </button>
  );
}

function Banners({
  updatesPaused,
  previewActive,
  session,
}: {
  updatesPaused: boolean;
  previewActive: boolean;
  session: PreviewSessionState;
}) {
  if (!updatesPaused && !previewActive) return null;
  return (
    <div className={styles.banners} role="status">
      {updatesPaused ? (
        <div className={`${styles.banner} ${styles.bannerUpdatesPaused}`}>
          {copy.banners.updatesPaused}
        </div>
      ) : null}
      {previewActive ? (
        <div className={`${styles.banner} ${styles.bannerPreview}`} data-testid="preview-banner">
          {session?.expired === true ? (
            <span data-testid="preview-expired">{copy.banners.previewExpired}</span>
          ) : (
            <>
              {copy.banners.preview}
              <PreviewLiveNote />
            </>
          )}
          {session !== null ? (
            <button
              type="button"
              className={styles.bannerAction}
              onClick={endPreviewSession}
              data-testid="preview-exit"
            >
              {copy.banners.previewExit}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PreviewLiveNote() {
  const { lastChangeAt, reconnecting } = usePreviewLive();
  return (
    <>
      {lastChangeAt !== null ? (
        <span className={styles.bannerNote} data-testid="preview-live">
          {copy.banners.previewLive(formatClock(lastChangeAt))}
        </span>
      ) : null}
      {reconnecting ? (
        <span className={styles.bannerNote} data-testid="preview-reconnecting">
          {copy.banners.previewReconnecting}
        </span>
      ) : null}
    </>
  );
}

function Footer({ bundle }: { bundle: ContentBundle | null }) {
  const settings = bundle?.content?.settings ?? null;
  if (settings === null || bundle === null) return null;
  return (
    <footer className={styles.footer} data-testid="site-footer">
      {settings.footerLinks.length > 0 ? (
        <ul className={styles.footerLinks}>
          {settings.footerLinks.map((link, i) => (
            <li key={i}>
              <ContentLink link={link} bundle={bundle} />
            </li>
          ))}
        </ul>
      ) : null}
      {settings.footerText !== null ? (
        <p className={styles.footerText}>{settings.footerText}</p>
      ) : null}
    </footer>
  );
}
