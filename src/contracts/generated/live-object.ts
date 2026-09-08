/**
 * AUTO-GENERATED FILE. Do not edit by hand.
 * Run `npm run contracts:types` to regenerate from contracts/.
 */

export interface LiveObject {
  schemaVersion?: number;
  eventId?: number | null;
  eventStatusId?: number | null;
  pollIntervalMs?: number;
  snapshotUrl?: string;
  cookieTally?: {
    [k: string]: number | undefined;
  };
  seq?: number | null;
  lat?: number | null;
  lng?: number | null;
  speedMps?: number | null;
  altitudeM?: number | null;
  headingDeg?: number | null;
  accuracyM?: number | null;
  recordedAt?: string | null;
  receivedAt?: string | null;
  publishedAt?: string;
}
