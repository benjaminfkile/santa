// docs/site.md section 7.4. LatestMessage: `card`: body plus `createdAt`;
// `ticker`: one collapsible line;
// `aria-live="polite"`; nothing when null. Rendering a message with a
// numeric id marks it read through lib/messageSeen, in both styles and
// with the ticker collapsed, so the tracker's envelope pill clears its dot.

import { useEffect, useState } from "react";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { formatEventTime } from "../../../lib/time";
import { markMessageSeen } from "../../../lib/messageSeen";
import * as styles from "./LatestMessage.module.css";

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
  const eventId = typeof event?.id === "number" ? event.id : null;
  const messageId = typeof message?.id === "number" ? message.id : null;

  useEffect(() => {
    if (eventId !== null && messageId !== null) markMessageSeen(eventId, messageId);
  }, [eventId, messageId]);

  if (message === null || message === undefined) return null;

  const timeIso = message.createdAt ?? null;
  const timeText = formatEventTime(timeIso);
  const heading = d.heading ?? null;
  const body = message.body ?? "";

  if (style === "ticker") {
    return (
      <div className={`${styles.latestMessage} ${styles.latestMessageTicker}`} aria-live="polite" data-testid="latest-message">
        <button
          type="button"
          className={styles.latestMessageToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={styles.latestMessageTickerBody}>
            <Inline text={body} bundle={bundle} event={event} />
          </span>
          <span className={styles.latestMessageTime}>{timeText}</span>
        </button>
        {expanded ? (
          <div className={styles.latestMessageExpanded}>
            <p className={styles.latestMessageBody}>
              <Inline text={body} bundle={bundle} event={event} />
            </p>
            {snapshotStale ? (
              <p className={styles.latestMessageStale}>Refreshing details...</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${styles.latestMessage} ${styles.latestMessageCard}`} aria-live="polite" data-testid="latest-message">
      {heading ? (
        <div className={styles.latestMessageMeta}>
          <span className={styles.latestMessageHeading}>
            <Inline text={heading} bundle={bundle} event={event} />
          </span>
          {timeText ? <span className={styles.latestMessageTime}> · {timeText}</span> : null}
        </div>
      ) : timeText ? (
        <div className={styles.latestMessageMeta}>
          <span className={styles.latestMessageTime}>{timeText}</span>
        </div>
      ) : null}
      <p className={styles.latestMessageBody}>
        <Inline text={body} bundle={bundle} event={event} />
      </p>
      {snapshotStale ? (
        <p className={styles.latestMessageStale}>Refreshing details...</p>
      ) : null}
    </div>
  );
};
