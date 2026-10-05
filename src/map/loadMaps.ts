// docs/site.md section 8.1. Loader singleton for the Google Maps JS API.
// Imported only from sections/Map/Map.tsx and sections/RoutePreview when
// its style is `map`; a load failure surfaces as a "map unavailable"
// panel. The three library imports race a 15 s timer, so a script that
// loads without Google's callback firing fails with a named reason
// instead of hanging; any failure clears the attempt so the next call
// starts a new one.

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { env } from "../config/env";

export type MapsLibs = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
  geometry: google.maps.GeometryLibrary;
};

export const LOAD_TIMEOUT_MS = 15_000;

let configured = false;
let inFlight: Promise<MapsLibs> | null = null;

export async function loadMaps(): Promise<MapsLibs> {
  if (inFlight !== null) return inFlight;
  if (!configured) {
    setOptions({ key: env.GOOGLE_MAPS_KEY, v: "weekly" });
    configured = true;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Google Maps did not answer in ${LOAD_TIMEOUT_MS / 1000} s`)),
      LOAD_TIMEOUT_MS,
    );
  });
  const libs = Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
    importLibrary("geometry"),
  ]).then(([maps, marker, geometry]) => ({ maps, marker, geometry }));
  const p = Promise.race([libs, timeout]).finally(() => clearTimeout(timer));
  inFlight = p.catch((err) => {
    inFlight = null;
    throw err;
  });
  return inFlight;
}

export function resetMapsLoaderForTests(): void {
  configured = false;
  inFlight = null;
}
