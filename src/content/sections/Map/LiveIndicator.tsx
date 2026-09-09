// docs/site.md sections 5.2 and 7.6. "Live" when connected and not quiet;
// "Updating" when polling only; a trailing "updated N s ago" from
// `publishedAt` on the device clock.

import { useEffect, useState } from "react";
import { useStore } from "../../../store/useStore";
import { useNow } from "../../../lib/useNow";
import { isHubQuiet } from "../../../store/cadence";
import { copy } from "../../../copy/copy";

function usePerfTick(intervalMs = 1000): number {
  const [tick, setTick] = useState<number>(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(performance.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function LiveIndicator() {
  const hub = useStore((s) => s.hub);
  const publishedAt = useStore((s) => s.live?.publishedAt ?? null);
  const perfNow = usePerfTick(1000);
  const isQuiet = useStore((s) => isHubQuiet(s, perfNow));
  const now = useNow(1000);

  const hubLive = hub === "connected" && !isQuiet;
  const labelPrefix = hubLive ? copy.live.live : copy.live.updating;
  const publishedMs = publishedAt !== null ? Date.parse(publishedAt) : Number.NaN;
  const secondsAgo = Number.isFinite(publishedMs)
    ? Math.max(0, Math.floor((now - publishedMs) / 1000))
    : null;

  return (
    <div
      className={`live-indicator${hubLive ? " live-indicator--live" : " live-indicator--polling"}`}
      role="status"
      aria-live="polite"
    >
      <span className="live-indicator__dot" aria-hidden />
      <span className="live-indicator__label">{labelPrefix}</span>
      {secondsAgo !== null ? (
        <span className="live-indicator__ago"> · {copy.live.updatedAgo(secondsAgo)}</span>
      ) : null}
    </div>
  );
}
