// docs/site.md section 7.6. Grouped overlay chips shown above the map:
// live indicator, liftoff timer, waiting/signal-lost status.

import { useEffect, useState } from "react";
import { useStore } from "../../../store/useStore";
import { selectLiveState } from "../../../store/liveState";
import { copy } from "../../../copy/copy";
import { LiveIndicator } from "./LiveIndicator";
import { LiftoffTimer } from "./LiftoffTimer";

export type InfoOverlaysProps = {
  showLiveIndicator: boolean;
  showLiftoffTimer: boolean;
};

function usePerfNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function InfoOverlays({ showLiveIndicator, showLiftoffTimer }: InfoOverlaysProps) {
  const nowPerf = usePerfNow(1000);
  const liveState = useStore((s) => selectLiveState(s, nowPerf));
  const lastSeqChangeAt = useStore((s) => s.lastSeqChangeAt);

  const status = statusChipText(liveState, nowPerf, lastSeqChangeAt);

  return (
    <div className="info-overlays">
      {showLiveIndicator ? <LiveIndicator /> : null}
      {showLiftoffTimer ? <LiftoffTimer /> : null}
      {status !== null ? (
        <div
          className={`info-overlays__status info-overlays__status--${liveState}`}
          role="status"
          aria-live="polite"
          data-testid={liveState === "waitingForFix" ? "waiting-for-fix" : "signal-lost"}
        >
          {status}
        </div>
      ) : null}
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
