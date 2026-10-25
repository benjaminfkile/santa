// A fake clock and a queued animation frame for the Santa motion: the
// clock is `now`, `requestAnimationFrame` queues its callback, and `step`
// moves the clock frame by frame, running what is queued at each frame.
// `install` puts both on the globals (`performance.now` and the frame
// functions) for the controllers; the motion tests pass them in directly.

import { vi } from "vitest";

export const FRAME_MS = 16;

export function fakeFrames(start = 1000) {
  let t = start;
  let id = 0;
  const queue = new Map<number, () => void>();
  const frames = {
    now: () => t,
    raf: (cb: () => void) => {
      queue.set(++id, cb);
      return id;
    },
    caf: (handle: number) => {
      queue.delete(handle);
    },
    pending: () => queue.size,
    // Moves the clock `ms` forward, running the queued frames every
    // FRAME_MS on the way; `each` sees the clock after every frame.
    step(ms: number, each?: (now: number) => void) {
      const end = t + ms;
      while (t < end) {
        t = Math.min(end, t + FRAME_MS);
        const due = [...queue.values()];
        queue.clear();
        for (const cb of due) cb();
        each?.(t);
      }
    },
    // Moves the clock without running a frame.
    wait(ms: number) {
      t += ms;
    },
    install() {
      vi.spyOn(performance, "now").mockImplementation(() => t);
      vi.stubGlobal("requestAnimationFrame", frames.raf);
      vi.stubGlobal("cancelAnimationFrame", frames.caf);
      return frames;
    },
  };
  return frames;
}
