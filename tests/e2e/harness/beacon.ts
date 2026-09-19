// docs/site.md section 22.2. Beacon replay: POST /locations with the
// X-Beacon-Key header. recordedAt is set to now for every fix; the
// caller controls the rate and can stop replay at any point.
// heartbeat() posts one POST /beacons/heartbeat so the beacon's
// lastSeenAt is fresh, which the go-live rule requires (contracts 4.2,
// 4.5 Events). Both take the beacon key as an argument so the caller
// picks which beacon they act as.

import { e2eEnv } from "./env";

export type BeaconPoint = {
  lat: number;
  lng: number;
  speedMps?: number | null;
  altitudeM?: number | null;
  headingDeg?: number | null;
  accuracyM?: number | null;
};

async function postOne(point: BeaconPoint, beaconKey: string): Promise<void> {
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
      "X-Beacon-Key": beaconKey,
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

export function replay(points: BeaconPoint[], ratePerSecond: number, beaconKey: string): Replay {
  if (ratePerSecond <= 0) throw new Error("ratePerSecond must be positive");
  let cancelled = false;
  const intervalMs = 1000 / ratePerSecond;
  const done = (async () => {
    for (const p of points) {
      if (cancelled) return;
      await postOne(p, beaconKey);
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

export async function heartbeat(beaconKey: string): Promise<void> {
  const body = {
    sentAt: new Date().toISOString(),
    health: { batteryPercent: 100 },
  };
  const res = await fetch(`${e2eEnv.API_BASE_URL}/beacons/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beacon-Key": beaconKey,
    },
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`beacon POST /beacons/heartbeat → ${res.status}`);
}
