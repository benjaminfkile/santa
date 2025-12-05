export default function formatElapsed(liftoffTimestamp: number | null | undefined): string {
  if (!liftoffTimestamp || liftoffTimestamp <= 0) {
    return "0s";
  }

  const seconds = Math.floor((Date.now() - liftoffTimestamp) / 1000);

  if (seconds <= 0) return "0s";

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
