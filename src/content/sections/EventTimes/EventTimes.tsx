// docs/site.md section 7.4. EventTimes: one labelled line per field in
// `data.fields` whose value exists, formatted in `America/Denver`;
// `airborneFor` is `formatElapsed(now - wentLiveAt)` on the 1 s clock while
// status is 3; blank while `!timeReady`.

import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useStore } from "../../../store/useStore";
import { selectTimeReady } from "../../../store/liveState";
import { formatElapsed, formatMountainTime } from "../../../lib/time";
import { useNow } from "../../../lib/useNow";
import * as styles from "./EventTimes.module.css";

type FieldKey = "scheduledAt" | "wentLiveAt" | "endedAt" | "airborneFor";

type EventTimesData = {
  heading?: string | null;
  fields?: FieldKey[];
  labels?: Partial<Record<FieldKey, string>>;
};

const DEFAULT_LABELS: Record<FieldKey, string> = {
  scheduledAt: "Scheduled",
  wentLiveAt: "Liftoff",
  endedAt: "Wheels down",
  airborneFor: "Airborne for",
};

const ALL_FIELDS: FieldKey[] = ["scheduledAt", "wentLiveAt", "endedAt", "airborneFor"];

export const EventTimes: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as EventTimesData;
  const fields = Array.isArray(d.fields) && d.fields.length > 0 ? d.fields : ALL_FIELDS;
  const labels = { ...DEFAULT_LABELS, ...(d.labels ?? {}) };
  const event = useSnapshotEvent();
  const statusId = useStore((s) => s.live?.eventStatusId ?? null);
  const timeReady = useStore(selectTimeReady);
  const now = useNow(1000);

  if (!timeReady) {
    return <div className={`${styles.eventTimes} ${styles.eventTimesBlank}`} aria-hidden />;
  }

  const rows: { key: FieldKey; label: string; value: string }[] = [];
  for (const key of fields) {
    if (key === "airborneFor") {
      if (statusId !== 3) continue;
      const wentLive = event?.wentLiveAt;
      if (!wentLive) continue;
      const t = Date.parse(wentLive);
      if (Number.isNaN(t)) continue;
      rows.push({ key, label: labels[key], value: formatElapsed(now - t) });
      continue;
    }
    const value = event?.[key];
    if (!value) continue;
    rows.push({ key, label: labels[key], value: formatMountainTime(value) });
  }

  if (rows.length === 0) return <div className={`${styles.eventTimes} ${styles.eventTimesEmpty}`} />;

  const heading = d.heading ?? null;

  return (
    <div className={styles.eventTimes}>
      {heading ? (
        <h2 className={styles.eventTimesHeading}>
          <Inline text={heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      <dl className={styles.eventTimesList}>
        {rows.map((row) => (
          <div key={row.key} className={styles.eventTimesRow} data-row={row.key}>
            <dt className={styles.eventTimesLabel}>{row.label}</dt>
            <dd className={styles.eventTimesValue}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
