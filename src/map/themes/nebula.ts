// docs/site.md section 8.4. The `nebula` theme: purple-lit terrain with
// a mint route accent.

import type { MapTheme } from "./index";

export const nebulaTheme: MapTheme = {
  key: "nebula",
  label: "Nebula",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { elementType: "geometry", stylers: [{ color: "#1a103d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#d8c9ff" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0d0723" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#08051a" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b1f5e" }] },
  ],
  routeColor: "#5eead4",
  routeOpacity: 0.95,
  arrowColor: "#5eead4",
  timeLabelBg: "#0d0723",
  timeLabelFg: "#f8fafc",
  timeLabelOpacity: 0.95,
  userColor: "#fde68a",
};
