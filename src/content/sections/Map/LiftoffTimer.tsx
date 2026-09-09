// docs/site.md section 7.6. "Airborne 1h 12m" via `formatElapsed`; blank
// when `!timeReady` or `wentLiveAt` is null.

import { useStore } from "../../../store/useStore";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { selectTimeReady } from "../../../store/liveState";
import { formatElapsed } from "../../../lib/time";
import { useNow } from "../../../lib/useNow";

export function LiftoffTimer() {
  const event = useSnapshotEvent();
  const timeReady = useStore(selectTimeReady);
  const now = useNow(1000);
  const wentLiveAt = event?.wentLiveAt ?? null;
  if (!timeReady || wentLiveAt === null || wentLiveAt === undefined || wentLiveAt === "") {
    return <div className="liftoff-timer liftoff-timer--blank" aria-hidden />;
  }
  const started = Date.parse(wentLiveAt);
  if (Number.isNaN(started)) return <div className="liftoff-timer liftoff-timer--blank" aria-hidden />;
  const elapsed = now - started;
  return (
    <div className="liftoff-timer" role="status">
      <span className="liftoff-timer__label">Airborne</span>
      <span className="liftoff-timer__value"> {formatElapsed(elapsed)}</span>
    </div>
  );
}
