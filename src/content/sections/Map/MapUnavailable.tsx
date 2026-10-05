// docs/site.md sections 7.6 and 8.1. The "map unavailable" panel, shown by
// the map section when the libraries fail to load and by the section's
// error boundary when anything under it throws. It names the reason in one
// line under the title, and its button reloads the page.

import { copy } from "../../../copy/copy";
import { reloadPage } from "../../../lib/reload";
import * as styles from "./Map.module.css";
import * as btn from "../../../ui/Button.module.css";

export function MapUnavailable({ reason }: { reason: string | null }) {
  return (
    <div
      className={styles.unavailable}
      role="alert"
      data-testid="map-unavailable"
    >
      <p>{copy.map.unavailable}</p>
      {reason !== null ? (
        <p className={styles.unavailableReason} data-testid="map-unavailable-reason">
          {reason}
        </p>
      ) : null}
      <button type="button" className={btn.btn} onClick={() => reloadPage()}>
        {copy.map.retry}
      </button>
    </div>
  );
}
