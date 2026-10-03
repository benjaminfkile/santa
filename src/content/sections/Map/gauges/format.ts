// docs/site.md section 7.6. The flight data readouts as text, shared by
// the text instruments and the dock's collapsed handle pill.

import { formatElapsed } from "../../../../lib/time";
import { copy } from "../../../../copy/copy";
import { headingToCardinal } from "../../../../lib/units";

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

// Rounded degrees in 0 to 359 with the degree sign, then the cardinal of
// the rounded heading: "312° NW", and 359.6 reads "0° N".
export function headingText(degrees: number | null): string {
  if (!finite(degrees)) return copy.live.unavailablePlaceholder;
  const whole = ((Math.round(degrees) % 360) + 360) % 360;
  return `${whole}° ${headingToCardinal(whole)}`;
}

// "1h 12m" via formatElapsed; empty while the time is not ready.
export function airborneText(elapsedMs: number | null): string {
  return finite(elapsedMs) ? formatElapsed(elapsedMs) : "";
}
