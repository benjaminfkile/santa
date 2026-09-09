// docs/site.md sections 7.4 and 8. The `map` style of the `route_preview`
// section: reuses the map layer without the Santa marker and calls
// `fitRoute()` on load. Imported dynamically so it lands in the `map`
// chunk.

import { useEffect, useState } from "react";
import { MapView } from "../../../map/MapView";
import type { MapController } from "../../../map/mapController";
import { copy } from "../../../copy/copy";
import { useStore } from "../../../store/useStore";
import { resolveOfferedThemes, resolveDefaultTheme } from "../../../map/themes";

export type RoutePreviewMapProps = {
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  themeKey?: string | null;
};

export function RoutePreviewMap({ defaultCenter, defaultZoom, themeKey }: RoutePreviewMapProps) {
  const offered = resolveOfferedThemes(null);
  const theme = resolveDefaultTheme(themeKey ?? null, offered);
  const route = useStore((s) => s.route);
  const [controller, setController] = useState<MapController | null>(null);

  useEffect(() => {
    if (controller === null) return;
    controller.setRoute(route);
    controller.fitRoute();
  }, [controller, route]);

  const hasRoutePoints = (route?.points?.length ?? 0) >= 2;

  return (
    <MapView
      options={{
        theme,
        defaultCenter: defaultCenter ?? { lat: 39.7392, lng: -104.9903 },
        defaultZoom: defaultZoom ?? 5,
        showSantaMarker: false,
        showUserLocation: false,
      }}
      onController={setController}
      className="route-preview__map"
    >
      {({ error, retry }) =>
        error !== null ? (
          <div className="route-preview__unavailable" role="alert">
            <p>{copy.map.unavailable}</p>
            <button type="button" onClick={retry}>
              {copy.map.retry}
            </button>
          </div>
        ) : controller !== null && hasRoutePoints ? (
          <div data-testid="route-polyline" aria-hidden hidden />
        ) : null
      }
    </MapView>
  );
}

export default RoutePreviewMap;
