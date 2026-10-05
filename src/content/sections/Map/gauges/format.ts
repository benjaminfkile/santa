// docs/site.md section 7.6. The flight data readouts as text, shared by
// the dials and the dock's collapsed handle pill.

import { formatElapsed } from "../../../../lib/time";
import { formatCount } from "../../../../lib/number";
import { copy } from "../../../../copy/copy";
import { headingToCardinal } from "../../../../lib/units";

function finite(n: number | null): n is number {
  return n !== null && Number.isFinite(n);
}

// Whole mph, abbreviated from a thousand up like every other number on the
// tracker.
export function speedText(mph: number | null): string {
  return finite(mph) ? formatCount(mph) : copy.live.unavailablePlaceholder;
}

// Whole feet, abbreviated from a thousand up: 4120 reads "4.1k".
export function feetText(feet: number | null): string {
  return finite(feet) ? formatCount(feet) : copy.live.unavailablePlaceholder;
}

// Rounded degrees in 0 to 359 with the degree sign, then the cardinal of
// the rounded heading: "312° NW", and 359.6 reads "0° N". The tracker
// menu's data row keeps this reading; the compass shows the cardinal alone.
export function headingText(degrees: number | null): string {
  if (!finite(degrees)) return copy.live.unavailablePlaceholder;
  const whole = ((Math.round(degrees) % 360) + 360) % 360;
  return `${whole}° ${headingToCardinal(whole)}`;
}

// The cardinal of the rounded heading alone: "NW", and 359.6 reads "N".
export function headingCardinalText(degrees: number | null): string {
  if (!finite(degrees)) return copy.live.unavailablePlaceholder;
  const whole = ((Math.round(degrees) % 360) + 360) % 360;
  return headingToCardinal(whole);
}

// "1h 12m" via formatElapsed; empty while the time is not ready.
export function airborneText(elapsedMs: number | null): string {
  return finite(elapsedMs) ? formatElapsed(elapsedMs) : "";
}
