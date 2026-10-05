// docs/site.md sections 7.6 and 9. The live screen's cookie tally under
// the tracker menu button: a bare column, no box, one row per
// `snapshot.cookieTypes` entry ranked by `rankCookieTypes`, each row the
// count then the type's icon, right-aligned so a longer count hangs
// further left while the icons stay in one column. Legibility comes from
// a shadow in the chrome's panel colour. Rows reorder in place as live
// objects arrive, with no animation. A chevron above the column collapses
// it for a viewer who would rather not look at the counts; collapsed, the
// chevron is all that is left, and the choice is kept for the page load in
// trackerToggles like the tracker's other choices.

import { useState } from "react";
import type { IconRef } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { useStore } from "../../../store/useStore";
import { copy } from "../../../copy/copy";
import { formatCount } from "../../../lib/number";
import { ChevronGlyph } from "./glyphs";
import { readTrackerToggle, writeTrackerToggle } from "./trackerToggles";
import { Icon, iconResolves } from "../../primitives/Icon";
import { rankCookieTypes } from "../Leaderboard/Leaderboard";
import * as styles from "./Map.module.css";

const ICON_SIZE = 28;

function readIcon(icon: unknown): IconRef | null {
  if (icon === null || icon === undefined || typeof icon !== "object") return null;
  const source = (icon as { source?: unknown }).source;
  const id = (icon as { id?: unknown }).id;
  if ((source !== "library" && source !== "media") || typeof id !== "string") return null;
  return icon as IconRef;
}

export function CookieTally({ bundle }: { bundle: ContentBundle }) {
  const cookieTypes = useStore((s) => s.snapshot?.cookieTypes ?? null);
  const tally = useStore((s) => s.live?.cookieTally ?? null);
  const [open, setOpen] = useState<boolean>(() => readTrackerToggle("cookieTally", true));

  if (cookieTypes === null || cookieTypes.length === 0) return null;
  const ranked = rankCookieTypes(cookieTypes, tally ?? {});

  const toggle = () => {
    writeTrackerToggle("cookieTally", !open);
    setOpen(!open);
  };

  return (
    <div className={styles.cookieTallyWrap} data-testid="cookie-tally-wrap">
      <button
        type="button"
        className={`${styles.cookieTallyToggle}${open ? "" : " " + styles.cookieTallyToggleClosed}`}
        aria-expanded={open}
        aria-controls="cookie-tally-list"
        aria-label={open ? copy.map.cookieTally.hide : copy.map.cookieTally.show}
        title={open ? copy.map.cookieTally.hide : copy.map.cookieTally.show}
        onClick={toggle}
        data-testid="cookie-tally-toggle"
      >
        <ChevronGlyph size={18} />
      </button>
      {open ? (
        <ol id="cookie-tally-list" className={styles.cookieTally} data-testid="cookie-tally">
      {ranked.map((row) => {
        const icon = readIcon(row.icon);
        return (
          <li
            key={row.id}
            className={styles.cookieTallyRow}
            data-testid="cookie-tally-row"
            data-count={row.count}
            title={row.name ?? undefined}
          >
            <span className={styles.cookieTallyCount} data-testid="leaderboard-count">
              {formatCount(row.count)}
              {row.name ? <span className={styles.visuallyHidden}> {row.name}</span> : null}
            </span>
            {icon !== null && iconResolves(icon, bundle) ? (
              <span className={styles.cookieTallyIcon} aria-hidden data-testid="cookie-tally-icon">
                <Icon icon={icon} bundle={bundle} alt="" decorative size={ICON_SIZE} />
              </span>
            ) : (
              <span
                className={`${styles.cookieTallyIcon} ${styles.cookieTallyPlaceholder}`}
                aria-hidden
                data-testid="cookie-tally-icon"
              />
            )}
          </li>
        );
        })}
        </ol>
      ) : null}
    </div>
  );
}
