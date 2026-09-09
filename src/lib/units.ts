// docs/site.md section 2. Unit helpers.

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Cardinal = (typeof CARDINALS)[number];

export function mpsToMph(mps: number): number {
  return mps * 2.2369362920544;
}

export function metresToFeet(m: number): number {
  return m * 3.280839895013123;
}

export function metresToMiles(m: number): number {
  return m / 1609.344;
}

export function headingToCardinal(deg: number): Cardinal {
  const wrapped = ((deg % 360) + 360) % 360;
  const index = Math.round(wrapped / 45) % 8;
  return CARDINALS[index];
}
