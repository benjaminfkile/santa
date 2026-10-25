// docs/site.md section 8.7. The Santa motion against a fake clock and a
// queued animation frame: the pin advances every frame between fixes a
// short adaptive delay behind arrival (about 300 ms at 250 ms fixes, about
// 6 s at 5 s fixes), never passes the newest fix, and rests there with no
// frame scheduled when fixes stop; the delay follows a cadence change
// within eight fixes; the first fix, a gap over 30 s, a jump over 5 km or
// 250 m/s, and a return from hidden snap; a display far behind after a
// burst jumps to one delay behind; headings turn the short way and a null
// heading holds the last known one.

import { describe, it, expect } from "vitest";
import { createSantaMotion, type SantaFrame } from "../../../src/map/santaMotion";
import { fakeFrames } from "./fakeFrames";

// About 38 m east per step at this latitude.
const STEP_LNG = 0.0005;

function setup() {
  const frames = fakeFrames();
  const seen: SantaFrame[] = [];
  const motion = createSantaMotion({ ...frames, sink: (f) => seen.push(f) });
  let seq = 0;
  let newestLng = -Infinity;
  function fix(lng: number, headingDeg: number | null = null, lat = 46.9) {
    return { seq: ++seq, lat, lng, headingDeg };
  }
  // Pushes `n` fixes `interval` ms apart along the line, running the
  // frames between them; every frame is checked against the newest fix.
  function feed(n: number, interval: number) {
    for (let i = 0; i < n; i++) {
      frames.step(interval, () => {
        const last = seen[seen.length - 1];
        if (last !== undefined) expect(last.lng).toBeLessThanOrEqual(newestLng + 1e-12);
      });
      const lng = newestLng === -Infinity ? -114 : newestLng + STEP_LNG;
      newestLng = lng;
      motion.push(fix(lng), frames.now());
    }
  }
  return { frames, seen, motion, fix, feed, newest: () => newestLng };
}

function strictlyAdvancing(frames: SantaFrame[]): boolean {
  return frames.every((f, i) => i === 0 || f.lng > frames[i - 1].lng);
}

describe("playback", () => {
  it("at a steady 250 ms the pin advances every frame about 300 ms behind and rests on the last fix", () => {
    const { frames, seen, motion, feed, newest } = setup();
    feed(1, 0);
    expect(seen).toHaveLength(1);
    const first = seen.length;
    feed(20, 250);
    const played = seen.slice(first).filter((f) => f.moving);
    expect(played.length).toBeGreaterThan(20 * 10);
    expect(strictlyAdvancing(played)).toBe(true);
    expect(motion.delayMs()).toBeCloseTo(312.5);
    frames.step(2000);
    const last = seen[seen.length - 1];
    expect(last).toEqual({ lat: 46.9, lng: newest(), headingDeg: null, moving: false });
    expect(frames.pending()).toBe(0);
    const count = seen.length;
    frames.step(1000);
    expect(seen.length).toBe(count);
  });

  it("at a steady 5 s the pin advances every frame about 6 s behind", () => {
    const { frames, seen, motion, feed, newest } = setup();
    feed(1, 0);
    feed(8, 5000);
    const played = seen.slice(1).filter((f) => f.moving);
    expect(played.length).toBeGreaterThan(8 * 250);
    expect(strictlyAdvancing(played)).toBe(true);
    expect(motion.delayMs()).toBe(6000);
    frames.step(7000);
    expect(seen[seen.length - 1]).toMatchObject({ lng: newest(), moving: false });
    expect(frames.pending()).toBe(0);
  });

  it("the delay follows a cadence change from 5 s to 250 ms and back within eight fixes", () => {
    const { motion, feed } = setup();
    feed(1, 0);
    feed(8, 5000);
    expect(motion.delayMs()).toBe(6000);
    feed(8, 250);
    expect(motion.delayMs()).toBeLessThan(400);
    feed(8, 5000);
    expect(motion.delayMs()).toBe(6000);
  });

  it("a display left more than three delays behind by a burst jumps to one delay behind", () => {
    const { frames, seen, motion, fix, feed, newest } = setup();
    feed(1, 0);
    feed(10, 250);
    frames.step(2000);
    let lng = newest();
    for (let i = 0; i < 8; i++) {
      lng += STEP_LNG;
      frames.wait(1);
      motion.push(fix(lng), frames.now());
    }
    frames.step(400);
    expect(seen[seen.length - 1]).toMatchObject({ lng, moving: false });
  });
});

describe("snaps", () => {
  it("the first fix is placed at once with no frame", () => {
    const { frames, seen, motion, fix } = setup();
    motion.push(fix(-114, 45), frames.now());
    expect(seen).toEqual([{ lat: 46.9, lng: -114, headingDeg: 45, moving: false }]);
    expect(frames.pending()).toBe(0);
  });

  it("a fix after a 31 s gap is placed at once", () => {
    const { frames, seen, motion, fix, feed, newest } = setup();
    feed(1, 0);
    feed(4, 1000);
    frames.step(31_000);
    const count = seen.length;
    motion.push(fix(newest() + STEP_LNG), frames.now());
    expect(seen.length).toBe(count + 1);
    expect(seen[seen.length - 1]).toMatchObject({ lng: newest() + STEP_LNG, moving: false });
    expect(frames.pending()).toBe(0);
  });

  it("a 6 km jump is placed at once, and so is a move faster than 250 m/s", () => {
    const { frames, seen, motion, fix, feed, newest } = setup();
    feed(1, 0);
    feed(4, 1000);
    frames.step(1000);
    // About 6 km north.
    motion.push(fix(newest(), null, 46.954), frames.now());
    expect(seen[seen.length - 1]).toMatchObject({ lat: 46.954, moving: false });
    expect(frames.pending()).toBe(0);
    frames.step(1000);
    // About 1 km in a second.
    motion.push(fix(newest(), null, 46.963), frames.now());
    expect(seen[seen.length - 1]).toMatchObject({ lat: 46.963, moving: false });
    expect(frames.pending()).toBe(0);
  });

  it("visible(false) cancels the frames and visible(true) snaps to the newest fix", () => {
    const { frames, seen, motion, fix, feed, newest } = setup();
    feed(1, 0);
    feed(4, 250);
    expect(frames.pending()).toBe(1);
    motion.visible(false);
    expect(frames.pending()).toBe(0);
    const count = seen.length;
    frames.step(1000);
    expect(seen.length).toBe(count);
    motion.visible(true);
    expect(seen[seen.length - 1]).toMatchObject({ lng: newest(), moving: false });
    expect(frames.pending()).toBe(0);
    // The next push after a hidden spell snaps too.
    frames.step(250);
    motion.push(fix(newest() + STEP_LNG), frames.now());
    expect(seen[seen.length - 1]).toMatchObject({ lng: newest() + STEP_LNG, moving: false });
    expect(frames.pending()).toBe(0);
  });

  it("after rest the next fix is placed at once", () => {
    const { frames, seen, motion, fix, feed, newest } = setup();
    feed(1, 0);
    feed(3, 250);
    motion.rest();
    expect(frames.pending()).toBe(0);
    expect(motion.hasFix()).toBe(false);
    frames.step(250);
    motion.push(fix(newest() + STEP_LNG), frames.now());
    expect(seen[seen.length - 1]).toMatchObject({ lng: newest() + STEP_LNG, moving: false });
  });
});

describe("heading", () => {
  function turn(from: number | null, to: number | null, more: (number | null)[] = []) {
    const { frames, seen, motion, fix } = setup();
    motion.push(fix(-114, from), frames.now());
    let lng = -114;
    for (const h of [to, ...more]) {
      frames.step(1000);
      lng += STEP_LNG;
      motion.push(fix(lng, h), frames.now());
    }
    frames.step(4000);
    return seen.map((f) => f.headingDeg);
  }

  it("350 then 10 passes through 0", () => {
    const headings = turn(350, 10) as number[];
    expect(headings.some((h) => h > 350 && h < 360)).toBe(true);
    expect(headings.some((h) => h > 0 && h < 10)).toBe(true);
    expect(headings.some((h) => h > 10 && h < 350)).toBe(false);
    expect(headings[headings.length - 1]).toBe(10);
  });

  it("10 then 350 turns back through 0 the other way", () => {
    const headings = turn(10, 350) as number[];
    expect(headings.some((h) => h > 0 && h < 10)).toBe(true);
    expect(headings.some((h) => h > 350 && h < 360)).toBe(true);
    expect(headings.some((h) => h > 10 && h < 350)).toBe(false);
    expect(headings[headings.length - 1]).toBe(350);
  });

  it("null headings hold the last known one", () => {
    expect(new Set(turn(90, null, [null]))).toEqual(new Set([90]));
  });

  it("is null only while no fix has carried one", () => {
    const headings = turn(null, null, [120]);
    expect(headings[0]).toBeNull();
    expect(headings[headings.length - 1]).toBe(120);
  });
});
