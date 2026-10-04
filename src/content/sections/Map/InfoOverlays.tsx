// docs/site.md section 7.6. Two pills in the top-left stack: the
// waiting-for-fix and signal-lost status pill, shown under the live pill
// only while either state holds, and the distance pill, shown under it
// while the visitor has their location on and the distance is known.

import { useEffect, useState } from "react";
import { useStore } from "../../../store/useStore";
import { selectLiveState } from "../../../store/liveState";
import { copy } from "../../../copy/copy";
import { formatDistanceMetres } from "../../../map/userLocation";
import { PersonPinGlyph, SignalGlyph } from "./glyphs";
import * as styles from "./Map.module.css";

function usePerfNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function FixStatus() {
  const nowPerf = usePerfNow(1000);
  const liveState = useStore((s) => selectLiveState(s, nowPerf));
  const lastSeqChangeAt = useStore((s) => s.lastSeqChangeAt);

  const status = statusChipText(liveState, nowPerf, lastSeqChangeAt);
  if (status === null) return null;

  return (
    <div
      className={`${styles.infoOverlaysStatus}${liveState === "signalLost" ? " " + styles.infoOverlaysStatusSignalLost : ""}`}
      role="status"
      aria-live="polite"
      data-testid={liveState === "waitingForFix" ? "waiting-for-fix" : "signal-lost"}
    >
      <SignalGlyph />
      <span>{status}</span>
    </div>
  );
}

// The visitor's distance from Santa. The caller decides whether there is
// one to show (the distance chip overlay, the location on, a finite value),
// so the pill renders whatever it is handed. The value is not announced as
// it changes: it moves every second and a live region would talk over
// everything else.
export function DistancePill({ metres }: { metres: number }) {
  const text = formatDistanceMetres(metres);
  if (text === "") return null;
  return (
    <div className={styles.distancePill} data-testid="distance-pill">
      <PersonPinGlyph size={14} />
      <span className={styles.visuallyHidden}>{copy.map.distance.label}</span>
      <span>{text}</span>
    </div>
  );
}

function statusChipText(
  liveState: "waitingForFix" | "tracking" | "signalLost",
  now: number,
  lastSeqChangeAt: number | null,
): string | null {
  if (liveState === "waitingForFix") return copy.live.waitingForFix;
  if (liveState === "signalLost") {
    const seconds =
      lastSeqChangeAt !== null ? Math.max(0, Math.floor((now - lastSeqChangeAt) / 1000)) : 0;
    return copy.live.signalLostAgo(seconds);
  }
  return null;
}
