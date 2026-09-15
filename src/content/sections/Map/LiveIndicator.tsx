// docs/site.md sections 5.2 and 7.6. The pill answers one question, the
// transport: "Live" while this browser is joined to the hub, "Polling" while
// it is not and the poll is still landing, "Offline" when neither has reached
// us for a while. The beacon's own cadence never moves the label; a stalled
// beacon shows in the "Updated N s ago" counter (amber past the signal-lost
// threshold) and on the marker (FixStatus).
import { useEffect, useState } from "react";
import { useStore } from "../../../store/useStore";
import { useNow } from "../../../lib/useNow";
import { DEFAULT_POLL_INTERVAL_MS } from "../../../store/cadence";
import { copy } from "../../../copy/copy";
import * as styles from "./Map.module.css";

// The marker's signal-lost threshold (store/liveState.ts): the counter turns
// amber at the same moment the marker does.
export const STALE_AFTER_MS = 30000;

export type TransportState = "live" | "polling" | "offline";

export function transportState(
  hub: string,
  lastPollOkAt: number | null,
  pollIntervalMs: number,
  perfNow: number,
): TransportState {
  if (hub === "connected") return "live";
  if (lastPollOkAt !== null && perfNow - lastPollOkAt <= 2 * pollIntervalMs) return "polling";
  return "offline";
}

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
  const lastPollOkAt = useStore((s) => s.diag.lastPollOkAt);
  const pollIntervalMs = useStore((s) => s.live?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  const publishedAt = useStore((s) => s.live?.publishedAt ?? null);
  const perfNow = usePerfTick(1000);
  const now = useNow(1000);

  const state = transportState(hub, lastPollOkAt, pollIntervalMs, perfNow);
  const label =
    state === "live" ? copy.live.live : state === "polling" ? copy.live.updating : copy.live.offline;
  const stateClass =
    state === "live"
      ? styles.liveIndicatorLive
      : state === "polling"
        ? styles.liveIndicatorPolling
        : styles.liveIndicatorOffline;
  const publishedMs = publishedAt !== null ? Date.parse(publishedAt) : Number.NaN;
  const secondsAgo = Number.isFinite(publishedMs)
    ? Math.max(0, Math.floor((now - publishedMs) / 1000))
    : null;
  const stale = secondsAgo !== null && secondsAgo * 1000 > STALE_AFTER_MS;

  return (
    <div
      className={`${styles.liveIndicator} ${stateClass}`}
      role="status"
      aria-live="polite"
      data-transport={state}
    >
      <span className={styles.liveIndicatorDot} aria-hidden />
      <span className={styles.liveIndicatorLabel}>{label}</span>
      {secondsAgo !== null ? (
        <span className={`${styles.liveIndicatorAgo} ${stale ? styles.liveIndicatorAgoStale : ""}`}>
          {copy.live.updatedAgo(secondsAgo)}
        </span>
      ) : null}
    </div>
  );
}
