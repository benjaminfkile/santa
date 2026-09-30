// docs/site.md section 7.7. The header's inline nav above 760 px as a
// priority-plus nav: the items that fit the nav's width stay in the row and
// the rest collapse, last first, into a More dropdown at the end. A hidden,
// inert copy of the whole row (with a More button) is measured in a layout
// effect, on every resize of the nav or of the copy (which covers a font
// load), and when the fonts finish loading, so the row is settled before
// the browser paints and never wraps or clips.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { copy } from "../copy/copy";
import { visibleCount } from "./navOverflow";
import * as styles from "./Shell.module.css";

export type PriorityNavItem = { key: string; node: ReactNode };

export type PriorityNavProps = { items: PriorityNavItem[] };

export function PriorityNav({ items }: PriorityNavProps) {
  const [shown, setShown] = useState(items.length);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const navRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLUListElement | null>(null);
  const moreRef = useRef<HTMLLIElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const signature = items.map((i) => i.key).join("\n");

  const measure = useCallback((): number | null => {
    const nav = navRef.current;
    const list = measureRef.current;
    if (nav === null || list === null) return null;
    const cells = Array.from(list.children) as HTMLElement[];
    const more = cells.pop();
    if (more === undefined) return null;
    const gap = parseFloat(getComputedStyle(list).columnGap);
    return visibleCount({
      widths: cells.map((c) => c.getBoundingClientRect().width),
      gap: Number.isFinite(gap) ? gap : 0,
      moreWidth: more.getBoundingClientRect().width,
      available: nav.getBoundingClientRect().width,
    });
  }, []);

  useLayoutEffect(() => {
    const next = measure();
    if (next !== null) setShown(next);
  }, [measure, signature]);

  useEffect(() => {
    const apply = (): void => {
      const next = measure();
      if (next !== null) flushSync(() => setShown(next));
    };
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    if (navRef.current !== null) ro?.observe(navRef.current);
    if (measureRef.current !== null) ro?.observe(measureRef.current);
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    let alive = true;
    fonts?.addEventListener?.("loadingdone", apply);
    void fonts?.ready?.then(() => {
      if (alive) apply();
    });
    return () => {
      alive = false;
      ro?.disconnect();
      fonts?.removeEventListener?.("loadingdone", apply);
    };
  }, [measure]);

  const count = Math.min(shown, items.length);
  const overflow = items.slice(count);
  const hasMore = overflow.length > 0;
  const expanded = open && hasMore;

  // The menu starts closed whenever More comes back.
  useEffect(() => {
    if (!hasMore) setOpen(false);
  }, [hasMore]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) moreButtonRef.current?.focus();
  }, []);

  // A press outside the More button and its menu, or Escape, closes the menu.
  useEffect(() => {
    if (!expanded) return;
    function onDown(e: Event) {
      const target = e.target as Node | null;
      if (target !== null && moreRef.current?.contains(target)) return;
      close(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close(true);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded, close]);

  return (
    <nav aria-label="Pages" className={styles.inlineNav} ref={navRef}>
      <ul className={styles.inlineNavList}>
        {items.slice(0, count).map((item) => (
          <li key={item.key}>{item.node}</li>
        ))}
        {hasMore ? (
          <li ref={moreRef} className={styles.moreItem}>
            <button
              ref={moreButtonRef}
              type="button"
              className={styles.moreButton}
              aria-expanded={expanded}
              aria-controls={menuId}
              data-testid="nav-more"
              onClick={() => setOpen((v) => !v)}
            >
              {copy.nav.more}
              <ChevronGlyph />
            </button>
            {expanded ? (
            <ul
              id={menuId}
              className={styles.moreMenu}
              data-testid="nav-more-menu"
              onClick={(e) => {
                // Choosing any item closes the menu as it acts.
                const item = (e.target as Element).closest("a, button");
                if (item !== null && e.currentTarget.contains(item)) close(false);
              }}
            >
              {overflow.map((item) => (
                <li key={item.key}>{item.node}</li>
              ))}
            </ul>
            ) : null}
          </li>
        ) : null}
      </ul>
      <div className={styles.inlineNavMeasure} aria-hidden inert>
        <ul ref={measureRef} className={styles.inlineNavList} data-testid="nav-measure">
          {items.map((item) => (
            <li key={item.key}>{item.node}</li>
          ))}
          <li>
            <span className={styles.moreButton}>
              {copy.nav.more}
              <ChevronGlyph />
            </span>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function ChevronGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
