// docs/site.md section 8.4. The `standard` theme: light base map with a
// warm accent for the route overlay.

import type { MapTheme } from "./index";

export const standardTheme: MapTheme = {
  key: "standard",
  label: "Standard",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ],
  routeColor: "#c9452e",
  routeOpacity: 0.9,
  arrowColor: "#c9452e",
  timeLabelBg: "#ffffff",
  timeLabelFg: "#222222",
  timeLabelOpacity: 0.95,
  userColor: "#1f6feb",
};
