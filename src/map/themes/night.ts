// docs/site.md section 8.4. The `night` theme: deep-navy base with a
// bright candy-red route.

import type { MapTheme } from "./index";

export const nightTheme: MapTheme = {
  key: "night",
  label: "Night",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#c2d1e8" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#050a14" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e2a3d" }] },
  ],
  routeColor: "#ef4444",
  routeOpacity: 0.95,
  arrowColor: "#ef4444",
  timeLabelBg: "#0b1220",
  timeLabelFg: "#f8fafc",
  timeLabelOpacity: 0.95,
  userColor: "#f472b6",
};
