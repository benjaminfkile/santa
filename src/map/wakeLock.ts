// docs/site.md section 8.8. Acquired on live-screen mount and re-acquired
// on visibility; a denied or unsupported wake lock is silent.

let sentinel: WakeLockSentinel | null = null;

export async function acquire(): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!("wakeLock" in navigator)) return;
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    sentinel = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

export function release(): void {
  if (sentinel !== null) {
    try {
      void sentinel.release();
    } catch {
      // ignore
    }
  }
  sentinel = null;
}

export function isHeld(): boolean {
  return sentinel !== null;
}
