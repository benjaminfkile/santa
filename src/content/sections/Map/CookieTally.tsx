// docs/site.md sections 7.6 and 9. The live screen's cookie tally under
// the tracker menu button: a bare column, no box, one row per
// `snapshot.cookieTypes` entry ranked by `rankCookieTypes`, each row the
// count then the type's icon, right-aligned so a longer count hangs
// further left while the icons stay in one column. Legibility comes from
// a shadow in the chrome's panel colour. Rows reorder in place as live
// objects arrive, with no animation. Above the ranked rows, directly under
// the chevron, a total row built like the others shows the sum over every
// type with the plain cookie icon; it never reorders. The chevron collapses
// only the ranked rows for a viewer who would rather not look at them;
// collapsed, the chevron and the total are left, and the choice is stored
// in trackerToggles like the tracker's other choices and followed from
// there, so a replace from the account sync shows at once.

import type { IconRef } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { useStore } from "../../../store/useStore";
import { copy } from "../../../copy/copy";
import { formatCount } from "../../../lib/number";
import { ChevronGlyph, CookieGlyph } from "./glyphs";
import { useTrackerToggle, writeTrackerToggle } from "./trackerToggles";
import { Icon, iconResolves } from "../../primitives/Icon";
import { rankCookieTypes } from "../Leaderboard/Leaderboard";
import * as styles from "./Map.module.css";

const ICON_SIZE = 28;
const TOTAL_ICON: IconRef = { source: "library", id: "cookie" };

// The sum of the tally over every type; a type missing from it counts 0.
function cookieTotal(
  cookieTypes: readonly { id?: number }[],
  tally: Record<string, number> | null | undefined,
): number {
  let total = 0;
  for (const t of cookieTypes) {
    if (t.id === undefined) continue;
    const n = tally?.[String(t.id)];
    if (typeof n === "number" && Number.isFinite(n)) total += n;
  }
  return total;
}

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
  const open = useTrackerToggle("cookieTally", true);

  if (cookieTypes === null || cookieTypes.length === 0) return null;
  const ranked = rankCookieTypes(cookieTypes, tally ?? {});
  const total = cookieTotal(cookieTypes, tally);

  const toggle = () => {
    writeTrackerToggle("cookieTally", !open);
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
      <div
        className={`${styles.cookieTallyRow} ${styles.cookieTallyTotal}`}
        data-testid="cookie-tally-total"
        data-count={total}
        title={copy.map.cookieTally.total}
      >
        <span className={styles.cookieTallyCount} data-testid="cookie-tally-total-count">
          {formatCount(total)}
          <span className={styles.visuallyHidden}> {copy.map.cookieTally.total}</span>
        </span>
        <span className={styles.cookieTallyIcon} aria-hidden data-testid="cookie-tally-total-icon">
          {iconResolves(TOTAL_ICON, bundle) ? (
            <Icon icon={TOTAL_ICON} bundle={bundle} alt="" decorative size={ICON_SIZE} />
          ) : (
            <CookieGlyph size={ICON_SIZE} />
          )}
        </span>
      </div>
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
