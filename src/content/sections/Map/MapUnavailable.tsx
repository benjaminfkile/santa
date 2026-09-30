// docs/site.md sections 7.6 and 8.1. The "map unavailable" panel and its
// Retry, shown by the map section when the libraries fail to load and by
// the section's error boundary when anything under it throws.

import { copy } from "../../../copy/copy";
import * as styles from "./Map.module.css";
import * as btn from "../../../ui/Button.module.css";

export function MapUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className={styles.unavailable}
      role="alert"
      data-testid="map-unavailable"
    >
      <p>{copy.map.unavailable}</p>
      <button type="button" className={btn.btn} onClick={onRetry}>
        {copy.map.retry}
      </button>
    </div>
  );
}
