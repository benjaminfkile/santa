// docs/site.md section 2. One number format for the whole tracker: a count
// under a thousand reads as itself, and anything from a thousand up is
// abbreviated to one decimal, so 1100 reads "1.1k" rather than "1,100".
// Every number the live screen shows goes through this: cookie counts, the
// leaderboard, the watching count, the distance from Santa, speed,
// altitude and accuracy.

const UNITS = ["k", "M", "B"] as const;

// A whole number, abbreviated from a thousand up. A trailing ".0" is
// dropped, so 1000 is "1k" and 1100 is "1.1k". Rounding that would carry
// into the next unit does: 999,950 is "1M", never "1000k". Negatives keep
// their sign. A value that is not finite comes back as an empty string and
// the caller decides what to show instead.
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  if (n < 1000) return `${sign}${Math.round(n)}`;

  let scaled = n;
  let unit = -1;
  while (unit < UNITS.length - 1) {
    scaled = scaled / 1000;
    unit += 1;
    const rounded = Math.round(scaled * 10) / 10;
    if (rounded < 1000) {
      const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      return `${sign}${text}${UNITS[unit]}`;
    }
  }
  // Past the largest unit the number simply keeps counting in it.
  return `${sign}${Math.round(scaled)}${UNITS[UNITS.length - 1]}`;
}

// The same abbreviation with a unit after it: "1.1k ft".
export function formatCountWithUnit(value: number, unit: string): string {
  const text = formatCount(value);
  return text === "" ? "" : `${text} ${unit}`;
}
