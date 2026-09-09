// docs/site.md section 8.1. Loader singleton for the Google Maps JS API.
// Imported only from sections/Map/Map.tsx and sections/RoutePreview when
// its style is `map`; a load failure surfaces as a "map unavailable"
// panel.

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { env } from "../config/env";

export type MapsLibs = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
  geometry: google.maps.GeometryLibrary;
};

let configured = false;
let inFlight: Promise<MapsLibs> | null = null;

export async function loadMaps(): Promise<MapsLibs> {
  if (inFlight !== null) return inFlight;
  if (!configured) {
    setOptions({ key: env.GOOGLE_MAPS_KEY, v: "weekly" });
    configured = true;
  }
  const p = Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
    importLibrary("geometry"),
  ]).then(([maps, marker, geometry]) => ({ maps, marker, geometry }));
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
