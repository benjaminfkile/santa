// docs/site.md section 7.6. The flight data readouts as text, shared by
// the text instruments and the dock's collapsed handle pill.

import { formatElapsed } from "../../../../lib/time";
import { copy } from "../../../../copy/copy";

function finite(n: number | null): n is number {
  return n !== null && Number.isFinite(n);
}

// Whole mph.
export function speedText(mph: number | null): string {
  return finite(mph) ? String(Math.round(mph)) : copy.live.unavailablePlaceholder;
}

// Whole feet with a thousands separator.
export function feetText(feet: number | null): string {
  return finite(feet) ? Math.round(feet).toLocaleString("en-US") : copy.live.unavailablePlaceholder;
}

// Rounded degrees with the degree sign.
export function headingText(degrees: number | null): string {
  return finite(degrees) ? `${Math.round(degrees)}°` : copy.live.unavailablePlaceholder;
}

// "1h 12m" via formatElapsed; empty while the time is not ready.
export function airborneText(elapsedMs: number | null): string {
  return finite(elapsedMs) ? formatElapsed(elapsedMs) : "";
}
