// docs/site.md section 9. Leaderboard: one row per `snapshot.cookieTypes`
// entry; icon, name, count; `panel` collapses to five, `full` shows all.
// A count change animates the row order unless reduced motion.

import { useState } from "react";
import type { SectionComponent } from "../../registry";
import type { CookieType, IconRef, LiveObject, Snapshot } from "../../../contracts";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import * as styles from "./Leaderboard.module.css";

type LeaderboardData = {
  heading?: string | null;
  variant?: "panel" | "full";
  emptyText?: string | null;
};

export type RankedCookieType = CookieType & { count: number };

export function rankCookieTypes(
  cookieTypes: NonNullable<Snapshot["cookieTypes"]>,
  tally: NonNullable<LiveObject["cookieTally"]>,
): RankedCookieType[] {
  return cookieTypes
    .map((t) => ({ ...t, count: tally[String(t.id)] ?? 0 }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const sortA = a.sort ?? 0;
      const sortB = b.sort ?? 0;
      if (sortA !== sortB) return sortA - sortB;
      return (a.id ?? 0) - (b.id ?? 0);
    });
}

const PANEL_LIMIT = 5;

export const Leaderboard: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as LeaderboardData;
  const variant = d.variant ?? "panel";
  const emptyText = d.emptyText ?? null;
  const event = useSnapshotEvent();
  const cookieTypes = useStore((s) => s.snapshot?.cookieTypes ?? null);
  const tally = useStore((s) => s.live?.cookieTally ?? {});
  const [expanded, setExpanded] = useState(false);

  if (cookieTypes === null) return null;
  if (cookieTypes.length === 0) {
    if (emptyText) {
      return (
        <div className={`${styles.leaderboard} ${styles.leaderboardEmpty}`}>
          {d.heading ? (
            <h2 className={styles.leaderboardHeading}>
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className={styles.leaderboardEmptyText}>
            <Inline text={emptyText} bundle={bundle} event={event} />
          </p>
        </div>
      );
    }
    return null;
  }

  const ranked = rankCookieTypes(cookieTypes, tally);
  const max = ranked.reduce((m, r) => Math.max(m, r.count), 0);
  const visible =
    variant === "panel" && !expanded ? ranked.slice(0, PANEL_LIMIT) : ranked;

  const variantClass = variant === "full" ? styles.leaderboardFull : styles.leaderboardPanel;

  return (
    <div className={`${styles.leaderboard} ${variantClass}`} data-variant={variant}>
      {d.heading ? (
        <h2 className={styles.leaderboardHeading}>
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <ol className={styles.leaderboardList}>
        {visible.map((row) => (
          <li
            key={row.id}
            className={styles.leaderboardRow}
            data-count={row.count}
          >
            {row.icon && typeof row.icon.id === "string" &&
             (row.icon.source === "library" || row.icon.source === "media") ? (
              <span className={styles.leaderboardIcon} aria-hidden>
                <Icon
                  icon={{ source: row.icon.source, id: row.icon.id } as IconRef}
                  bundle={bundle}
                  alt=""
                  decorative
                />
              </span>
            ) : (
              <span className={`${styles.leaderboardIcon} ${styles.leaderboardIconPlaceholder}`} aria-hidden />
            )}
            <span className={styles.leaderboardName}>{row.name}</span>
            {variant === "full" ? (
              <span
                className={styles.leaderboardBar}
                aria-hidden
                style={{
                  width: max > 0 ? `${(row.count / max) * 100}%` : "0",
                }}
              />
            ) : null}
            <span className={styles.leaderboardCount} data-testid="leaderboard-count">
              {row.count}
            </span>
          </li>
        ))}
      </ol>
      {variant === "panel" && ranked.length > PANEL_LIMIT ? (
        <button
          type="button"
          className={styles.leaderboardToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      ) : null}
    </div>
  );
};
