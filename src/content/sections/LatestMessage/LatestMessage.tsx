// docs/site.md section 7.4. LatestMessage: `card`: body plus `eventTime`
// (or `createdAt` when null); `ticker`: one collapsible line;
// `aria-live="polite"`; nothing when null.

import { useState } from "react";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { formatMountainTime } from "../../../lib/time";

type LatestMessageData = {
  heading?: string | null;
  style?: "card" | "ticker";
};

export const LatestMessage: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as LatestMessageData;
  const style = d.style ?? "card";
  const event = useSnapshotEvent();
  const snapshotStale = useStore((s) => s.diag.snapshotFetchFailing);
  const message = event?.latestMessage ?? null;
  const [expanded, setExpanded] = useState(false);

  if (message === null || message === undefined) return null;

  const timeIso = message.eventTime ?? message.createdAt ?? null;
  const timeText = formatMountainTime(timeIso);
  const heading = d.heading ?? null;
  const body = message.body ?? "";

  if (style === "ticker") {
    return (
      <div className="latest-message latest-message--ticker" aria-live="polite" data-testid="latest-message">
        <button
          type="button"
          className="latest-message__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="latest-message__ticker-body">
            <Inline text={body} bundle={bundle} event={event} />
          </span>
          <span className="latest-message__time">{timeText}</span>
        </button>
        {expanded ? (
          <div className="latest-message__expanded">
            <p className="latest-message__body">
              <Inline text={body} bundle={bundle} event={event} />
            </p>
            {snapshotStale ? (
              <p className="latest-message__stale">Refreshing details...</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="latest-message latest-message--card" aria-live="polite" data-testid="latest-message">
      {heading ? (
        <div className="latest-message__meta">
          <span className="latest-message__heading">
            <Inline text={heading} bundle={bundle} event={event} />
          </span>
          {timeText ? <span className="latest-message__time"> · {timeText}</span> : null}
        </div>
      ) : timeText ? (
        <div className="latest-message__meta">
          <span className="latest-message__time">{timeText}</span>
        </div>
      ) : null}
      <p className="latest-message__body">
        <Inline text={body} bundle={bundle} event={event} />
      </p>
      {snapshotStale ? (
        <p className="latest-message__stale">Refreshing details...</p>
      ) : null}
    </div>
  );
};
