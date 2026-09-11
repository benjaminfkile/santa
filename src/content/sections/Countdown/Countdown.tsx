// docs/site.md section 7.4. Countdown: `Xd Xh Xm Xs` from the 1 s clock;
// renders nothing unless status is 2 and `now < scheduledAt`; blank while
// `!timeReady`.

import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { selectTimeReady } from "../../../store/liveState";
import { formatCountdown, formatMountainTime } from "../../../lib/time";
import { useNow } from "../../../lib/useNow";
import "./Countdown.module.css";

type CountdownData = {
  heading?: string | null;
};

function parseScheduled(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export const Countdown: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as CountdownData;
  const event = useSnapshotEvent();
  const statusId = useStore((s) => s.live?.eventStatusId ?? null);
  const timeReady = useStore(selectTimeReady);
  const now = useNow(1000);

  if (statusId !== 2) return null;
  const scheduledMs = parseScheduled(event?.scheduledAt ?? null);
  const remaining = scheduledMs === null ? null : scheduledMs - now;
  if (scheduledMs !== null && remaining !== null && remaining <= 0) return null;
  const heading = d.heading ?? null;

  return (
    <div className="countdown frost" data-testid="countdown">
      {heading ? (
        <p className="countdown__heading">
          <Inline text={heading} bundle={bundle} event={event} />
        </p>
      ) : null}
      {timeReady && remaining !== null ? (
        <CountdownDigits remaining={remaining} />
      ) : (
        <div className="countdown__blank" aria-hidden />
      )}
      {timeReady && event?.scheduledAt ? (
        <p className="countdown__scheduled">
          {formatMountainTime(event.scheduledAt)}
        </p>
      ) : null}
    </div>
  );
};

function CountdownDigits({ remaining }: { remaining: number }) {
  const text = formatCountdown(remaining);
  const parts = text.split(" ");
  const labels = ["days", "hours", "min", "sec"];
  return (
    <div className="countdown__digits" aria-label={text}>
      {parts.map((part, i) => {
        const value = part.replace(/[a-z]+$/i, "");
        return (
          <span key={i} className="countdown__cell">
            <span className="countdown__value">{value}</span>
            <span className="countdown__label">{labels[i]}</span>
          </span>
        );
      })}
    </div>
  );
}
