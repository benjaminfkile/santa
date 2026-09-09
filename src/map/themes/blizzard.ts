// docs/site.md section 8.4. The `blizzard` theme: whited-out landscape
// with a cool blue accent.

import type { MapTheme } from "./index";

export const blizzardTheme: MapTheme = {
  key: "blizzard",
  label: "Blizzard",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { elementType: "geometry", stylers: [{ color: "#e8eef4" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9dbec" }] },
  ],
  routeColor: "#1e3a8a",
  routeOpacity: 0.9,
  arrowColor: "#1e3a8a",
  timeLabelBg: "#ffffff",
  timeLabelFg: "#0f172a",
  timeLabelOpacity: 0.95,
  userColor: "#0ea5e9",
};
