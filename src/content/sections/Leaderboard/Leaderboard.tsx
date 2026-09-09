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
        <div className="leaderboard leaderboard--empty">
          {d.heading ? (
            <h2 className="leaderboard__heading">
              <Inline text={d.heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          <p className="leaderboard__empty-text">
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

  return (
    <div className={`leaderboard leaderboard--${variant}`}>
      {d.heading ? (
        <h2 className="leaderboard__heading">
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <ol className="leaderboard__list">
        {visible.map((row) => (
          <li
            key={row.id}
            className="leaderboard__row"
            data-count={row.count}
          >
            {row.icon && typeof row.icon.id === "string" &&
             (row.icon.source === "library" || row.icon.source === "media") ? (
              <span className="leaderboard__icon" aria-hidden>
                <Icon
                  icon={{ source: row.icon.source, id: row.icon.id } as IconRef}
                  bundle={bundle}
                  alt=""
                  decorative
                />
              </span>
            ) : (
              <span className="leaderboard__icon leaderboard__icon--placeholder" aria-hidden />
            )}
            <span className="leaderboard__name">{row.name}</span>
            {variant === "full" ? (
              <span
                className="leaderboard__bar"
                aria-hidden
                style={{
                  width: max > 0 ? `${(row.count / max) * 100}%` : "0",
                }}
              />
            ) : null}
            <span className="leaderboard__count" data-testid="leaderboard-count">
              {row.count}
            </span>
          </li>
        ))}
      </ol>
      {variant === "panel" && ranked.length > PANEL_LIMIT ? (
        <button
          type="button"
          className="leaderboard__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      ) : null}
    </div>
  );
};
