// docs/site.md section 8.9. The route map's time slider: a range input
// whose steps are exactly the timeline entries (value = entry index), the
// full card width, with the selected entry's elapsed time label beside it. The
// arrow keys step one entry and Home and End jump to the first and last;
// `aria-valuetext` is the visible label.

import type { KeyboardEvent } from "react";
import { copy } from "../../../copy/copy";
import type { TimelineEntry } from "./routeTimelineData";
import * as styles from "./RoutePreview.module.css";

export type RouteTimeSliderProps = {
  timeline: readonly TimelineEntry[];
  index: number;
  label: string;
  onSelect: (index: number) => void;
};

export function RouteTimeSlider({ timeline, index, label, onSelect }: RouteTimeSliderProps) {
  const last = timeline.length - 1;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(last, index + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(0, index - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== index) onSelect(next);
  }

  return (
    <div className={styles.routeTimeline} data-testid="route-timeline">
      <span className={styles.routeTimelineLabel} data-testid="route-timeline-label">
        {label}
      </span>
      <input
        type="range"
        className={styles.routeTimelineSlider}
        min={0}
        max={last}
        step={1}
        value={index}
        aria-label={copy.map.routeTime}
        aria-valuetext={label}
        data-testid="route-timeline-slider"
        onChange={(event) => onSelect(Number(event.currentTarget.value))}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
