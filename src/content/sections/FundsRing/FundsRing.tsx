// docs/site.md section 7.4. FundsRing: SVG ring filled to the percent with
// the number in the middle, animated fill unless reduced motion; `showYear`
// adds the year to the heading; 0 and no year when `event` is null.

import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { useReducedMotion } from "../../../lib/motion";

type FundsRingData = {
  heading?: string | null;
  caption?: string | null;
  size?: "small" | "medium" | "large";
  showYear?: boolean;
};

const SIZE_PX: Record<"small" | "medium" | "large", number> = {
  small: 120,
  medium: 160,
  large: 200,
};

function clampPercent(n: number | undefined | null): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export const FundsRing: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as FundsRingData;
  const size = d.size ?? "large";
  const px = SIZE_PX[size];
  const showYear = d.showYear !== false;
  const event = useSnapshotEvent();
  const percent = event ? clampPercent(event.fundsPercent) : 0;
  const reduced = useReducedMotion();

  const stroke = 16;
  const radius = px / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  const yearSuffix = showYear && event?.year ? ` ${event.year}` : "";
  const heading = d.heading !== null && d.heading !== undefined && d.heading !== ""
    ? `${d.heading}${yearSuffix}`
    : null;

  return (
    <div className={`funds-ring funds-ring--${size}`}>
      <div className="funds-ring__ring" style={{ width: px, height: px }}>
        <svg
          className="funds-ring__svg"
          width={px}
          height={px}
          viewBox={`0 0 ${px} ${px}`}
          role="img"
          aria-label={`${Math.round(percent)}%`}
        >
          <circle
            className="funds-ring__track"
            cx={px / 2}
            cy={px / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
          />
          <circle
            className={`funds-ring__fill${reduced ? " funds-ring__fill--reduced" : ""}`}
            cx={px / 2}
            cy={px / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${px / 2} ${px / 2})`}
          />
        </svg>
        <div className="funds-ring__value">{Math.round(percent)}%</div>
      </div>
      {heading || d.caption ? (
        <div className="funds-ring__text">
          {heading ? (
            <h2 className="funds-ring__heading">
              <Inline text={heading} bundle={bundle} event={event} />
            </h2>
          ) : null}
          {d.caption ? (
            <p className="funds-ring__caption">
              <Inline text={d.caption} bundle={bundle} event={event} />
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
