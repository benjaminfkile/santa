// docs/site.md sections 8.7 and 17. The Santa pin's playback, renderer
// free: both tracker controllers feed it every new fix and place the pin
// where its sink says. The fixes are kept in arrival order with their
// arrival times (the caller's clock, never `recordedAt`, so device clock
// skew cannot matter). On each animation frame the display time, a
// playback delay behind the clock, picks the two fixes that bracket it,
// and the sink gets the position interpolated linearly between them and
// the heading interpolated the short way around. A null heading takes the
// last known one, so the display heading is null only before any fix
// carried one.
// The delay is the median of the last eight arrival intervals times 1.25,
// clamped to 300 ms and 6000 ms, re-evaluated on every push. The display
// clock runs at normal speed and closes a gap to that target at up to
// half speed either way, so a delay change bends the pace instead of
// jumping, and it never runs backwards. It never passes the newest fix's
// arrival: there the pin holds (no extrapolation) and the frame loop
// idles with no frame scheduled until the next push. When the display
// falls more than three delays behind the newest fix it jumps forward to
// one delay behind.
// A push snaps (the display goes straight to the fix and the queue is
// cleared) when it is the first fix, when more than 30 s passed since the
// previous arrival, when the straight line from the previous fix is over
// 5 km or implies more than 250 m/s (over at least the playback delay, the
// least time the display takes to cover it, so a jittered or burst arrival
// is not a jump), or when the page was hidden since the
// previous push. `visible(false)` cancels the frame loop; `visible(true)`
// snaps to the newest fix and resumes. `rest` clears the queue; `dispose`
// cancels everything and every method is a no-op after it.

import { shortestDelta } from "./santaPin";

export type SantaFix = { seq: number; lat: number; lng: number; headingDeg: number | null };

export type SantaFrame = { lat: number; lng: number; headingDeg: number | null; moving: boolean };

export type SantaMotion = {
  push(fix: SantaFix, arrivedAt: number): void;
  rest(): void;
  visible(on: boolean): void;
  // The playback delay in ms now.
  delayMs(): number;
  // Whether the display has a fix (a pin to place).
  hasFix(): boolean;
  dispose(): void;
};

export type SantaMotionOptions = {
  now: () => number;
  raf: (cb: () => void) => number;
  caf: (id: number) => void;
  sink: (frame: SantaFrame) => void;
};

export const MIN_DELAY_MS = 300;
export const MAX_DELAY_MS = 6000;
export const DELAY_FACTOR = 1.25;
export const INTERVAL_WINDOW = 8;
// The `signalLost` threshold of 5.2.
export const SNAP_GAP_MS = 30_000;
export const SNAP_DISTANCE_M = 5000;
export const SNAP_SPEED_MPS = 250;
// The longest a recenter's animated pan holds the controllers' per frame
// follow back when the map never reports it settled.
export const RECENTER_PAN_MS = 1500;
const LAG_DELAYS = 3;
const CATCH_UP = 0.5;

type Entry = { fix: SantaFix; at: number };

// Degrees from `a` to `b` the short way around, in [-180, 180), shared
// with the heading indicator (santaPin.ts).
export { shortestDelta };

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// The great circle distance between two points in metres.
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function createSantaMotion(opts: SantaMotionOptions): SantaMotion {
  const { now, raf, caf, sink } = opts;
  let queue: Entry[] = [];
  let intervals: number[] = [];
  let delay = MIN_DELAY_MS;
  let displayT = 0;
  let lastFrame = 0;
  let frame: number | null = null;
  let shown = true;
  let hiddenSincePush = false;
  let lastHeading: number | null = null;
  let disposed = false;

  function newest(): Entry | undefined {
    return queue[queue.length - 1];
  }

  function cancel(): void {
    if (frame !== null) caf(frame);
    frame = null;
  }

  function schedule(): void {
    if (frame !== null || !shown || disposed) return;
    frame = raf(tick);
  }

  function snapTo(entry: Entry): void {
    cancel();
    queue = [entry];
    displayT = entry.at;
    const { lat, lng, headingDeg } = entry.fix;
    sink({ lat, lng, headingDeg, moving: false });
  }

  function heading(a: number | null, b: number | null, f: number): number | null {
    if (a === null) return b;
    if (b === null) return a;
    return normalize(a + shortestDelta(a, b) * f);
  }

  function tick(): void {
    frame = null;
    if (disposed || !shown) return;
    const last = newest();
    if (last === undefined) return;
    const t = now();
    const step = Math.max(0, t - lastFrame);
    lastFrame = t;
    const target = t - delay;
    let next = displayT + step;
    next += Math.max(-step * CATCH_UP, Math.min(step * CATCH_UP, target - next));
    if (last.at - next > LAG_DELAYS * delay) next = last.at - delay;
    displayT = Math.min(Math.max(displayT, next), last.at);
    while (queue.length >= 2 && queue[1].at <= displayT) queue.shift();
    const a = queue[0];
    const b = queue[1];
    const moving = displayT < last.at;
    if (b === undefined) {
      sink({ lat: a.fix.lat, lng: a.fix.lng, headingDeg: a.fix.headingDeg, moving: false });
      return;
    }
    const span = b.at - a.at;
    const f = span <= 0 ? 1 : Math.min(1, Math.max(0, (displayT - a.at) / span));
    sink({
      lat: a.fix.lat + (b.fix.lat - a.fix.lat) * f,
      lng: a.fix.lng + (b.fix.lng - a.fix.lng) * f,
      headingDeg: heading(a.fix.headingDeg, b.fix.headingDeg, f),
      moving,
    });
    if (moving) schedule();
  }

  return {
    push(input, arrivedAt) {
      if (disposed) return;
      const prev = newest();
      if (prev !== undefined && input.seq === prev.fix.seq) return;
      const headingDeg = input.headingDeg ?? lastHeading;
      if (input.headingDeg !== null) lastHeading = input.headingDeg;
      const entry: Entry = { fix: { ...input, headingDeg }, at: arrivedAt };
      const wasHidden = hiddenSincePush;
      hiddenSincePush = !shown;
      if (prev === undefined) {
        snapTo(entry);
        return;
      }
      const gap = arrivedAt - prev.at;
      if (gap > SNAP_GAP_MS) {
        snapTo(entry);
        return;
      }
      intervals.push(Math.max(0, gap));
      if (intervals.length > INTERVAL_WINDOW) intervals = intervals.slice(-INTERVAL_WINDOW);
      delay = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, median(intervals) * DELAY_FACTOR));
      const metres = distanceMetres(prev.fix, entry.fix);
      const seconds = Math.max(gap, delay) / 1000;
      const speed = seconds > 0 ? metres / seconds : metres > 0 ? Infinity : 0;
      if (wasHidden || metres > SNAP_DISTANCE_M || speed > SNAP_SPEED_MPS) {
        snapTo(entry);
        return;
      }
      queue.push(entry);
      if (frame === null) lastFrame = now();
      schedule();
    },
    rest() {
      if (disposed) return;
      cancel();
      queue = [];
      lastHeading = null;
    },
    visible(on) {
      if (disposed || on === shown) return;
      shown = on;
      if (!on) {
        hiddenSincePush = true;
        cancel();
        return;
      }
      const last = newest();
      if (last !== undefined) snapTo(last);
    },
    delayMs: () => delay,
    hasFix: () => queue.length > 0,
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      queue = [];
    },
  };
}

// Feeds `motion.visible` from the document's visibility until the returned
// function is called.
export function followPageVisibility(motion: SantaMotion): () => void {
  if (typeof document === "undefined") return () => {};
  const sync = () => motion.visible(document.visibilityState !== "hidden");
  sync();
  document.addEventListener("visibilitychange", sync);
  return () => document.removeEventListener("visibilitychange", sync);
}
