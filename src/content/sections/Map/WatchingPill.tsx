// docs/site.md section 7.6. The count of connected viewers from
// `live.onlineCount` on a pill: "1 watching", "12,345 watching". A null or
// absent count (sockets off or the hub unhealthy) renders nothing.

import { useStore } from "../../../store/useStore";
import { copy } from "../../../copy/copy";
import * as styles from "./Map.module.css";

export function WatchingPill() {
  const count = useStore((s) => s.live?.onlineCount ?? null);
  if (count === null || !Number.isFinite(count)) return null;
  return (
    <div className={styles.watchingPill} data-testid="watching-pill">
      <span>{copy.live.watching(count)}</span>
    </div>
  );
}
