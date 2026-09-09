// docs/site.md section 22.2. Beacon replay: POST /locations with the
// X-Beacon-Key header. recordedAt is set to now for every fix; the
// caller controls the rate and can stop replay at any point.

import { e2eEnv } from "./env";

export type BeaconPoint = {
  lat: number;
  lng: number;
  speedMps?: number | null;
  altitudeM?: number | null;
  headingDeg?: number | null;
  accuracyM?: number | null;
};

async function postOne(point: BeaconPoint): Promise<void> {
  const body = {
    lat: point.lat,
    lng: point.lng,
    speedMps: point.speedMps ?? null,
    altitudeM: point.altitudeM ?? null,
    headingDeg: point.headingDeg ?? null,
    accuracyM: point.accuracyM ?? null,
    recordedAt: new Date().toISOString(),
  };
  const res = await fetch(`${e2eEnv.API_BASE_URL}/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beacon-Key": e2eEnv.BEACON_KEY,
    },
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`beacon POST /locations → ${res.status}`);
}

export type Replay = {
  stop: () => void;
  done: Promise<void>;
};

export function replay(points: BeaconPoint[], ratePerSecond: number): Replay {
  if (ratePerSecond <= 0) throw new Error("ratePerSecond must be positive");
  let cancelled = false;
  const intervalMs = 1000 / ratePerSecond;
  const done = (async () => {
    for (const p of points) {
      if (cancelled) return;
      await postOne(p);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return {
    stop: () => {
      cancelled = true;
    },
    done,
  };
}
