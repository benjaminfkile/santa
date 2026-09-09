// docs/site.md section 5.5. A shared 1 s UI clock used by the countdown,
// liftoff timer, "updated N s ago", and signal-lost evaluation. It does
// not touch the store.

import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
