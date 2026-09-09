// docs/site.md section 2. Time helpers: `formatCountdown`, `formatElapsed`,
// and `formatMountainTime`. `America/Denver` is the canonical event zone.

const MOUNTAIN_ZONE = "America/Denver";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function safeParse(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function formatCountdown(msRemaining: number): string {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) return "0d 0h 0m 0s";
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export function formatElapsed(msElapsed: number): string {
  if (!Number.isFinite(msElapsed) || msElapsed <= 0) return "0m";
  const totalMinutes = Math.floor(msElapsed / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function partsOf(fmt: Intl.DateTimeFormat, date: Date): Record<string, string> {
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return map;
}

export function formatMountainTime(iso: string | null | undefined): string {
  const ms = safeParse(iso);
  if (ms === null) return "";
  const date = new Date(ms);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: MOUNTAIN_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  const p = partsOf(fmt, date);
  const month = p.month ?? "";
  const day = p.day ?? "";
  const hour = p.hour ?? "";
  const minute = p.minute ?? pad2(0);
  const dayPeriod = p.dayPeriod ?? "";
  const zone = p.timeZoneName ?? "";
  return `${month} ${day}, ${hour}:${minute} ${dayPeriod} ${zone}`.trim();
}
