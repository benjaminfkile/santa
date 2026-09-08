// docs/site.md sections 6.1, 6.3, 6.5. 1 s, 2 s, 3 s, then 5 s forever.

export const BACKOFF_STEPS_MS = [1000, 2000, 3000] as const;
export const BACKOFF_TAIL_MS = 5000;

export function backoffAt(attempt: number): number {
  if (attempt < 0) return BACKOFF_STEPS_MS[0];
  if (attempt < BACKOFF_STEPS_MS.length) return BACKOFF_STEPS_MS[attempt]!;
  return BACKOFF_TAIL_MS;
}

export function createBackoff() {
  let attempt = 0;
  return {
    next(): number {
      const ms = backoffAt(attempt);
      attempt += 1;
      return ms;
    },
    reset(): void {
      attempt = 0;
    },
    get attempt(): number {
      return attempt;
    },
  };
}
