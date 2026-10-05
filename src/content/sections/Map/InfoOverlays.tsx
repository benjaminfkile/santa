// docs/site.md section 7.6. Three pills in the top-left stack, under the
// live pill: the airborne pill, the time since liftoff, up whenever the
// flight has one; the distance pill while the visitor has their location on
// and the distance is known; and the waiting-for-fix and signal-lost status
// pill, only while either state holds.

import { useEffect, useState } from "react";
import { useStore } from "../../../store/useStore";
import { selectLiveState } from "../../../store/liveState";
import { copy } from "../../../copy/copy";
import { formatDistanceMetres } from "../../../map/userLocation";
import { formatElapsed } from "../../../lib/time";
import { useNow } from "../../../lib/useNow";
import { selectTimeReady } from "../../../store/liveState";
import { PersonPinGlyph, SignalGlyph, TakeoffGlyph } from "./glyphs";
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

// How long Santa has been flying, from the event's liftoff time on the one
// second clock. It is not in the gauge's cycle: the flight's own clock is
// something a visitor wants up the whole time, not one tap of five. Nothing
// shows until the clock is ready and the event has a liftoff time, so the
// pill is absent rather than showing a placeholder. Not a live region: it
// moves every second.
export function AirbornePill() {
  const wentLiveAt = useStore((s) => s.snapshot?.event?.wentLiveAt ?? null);
  const timeReady = useStore(selectTimeReady);
  const now = useNow(1000);
  if (!timeReady || wentLiveAt === null || wentLiveAt === "") return null;
  const started = Date.parse(wentLiveAt);
  if (Number.isNaN(started)) return null;
  return (
    <div className={styles.airbornePill} data-testid="airborne-pill">
      <TakeoffGlyph size={14} />
      <span className={styles.visuallyHidden}>{copy.map.airborne.label}</span>
      <span>{formatElapsed(now - started)}</span>
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
