// docs/site.md sections 7.6 and 8. The live screen: full-viewport map
// with overlays, each switched by `data.overlays` and each control by
// `data.controls`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SectionComponent } from "../../registry";
import { store, useStore } from "../../../store/useStore";
import { selectLiveState } from "../../../store/liveState";
import { copy } from "../../../copy/copy";
import { storageGet, storageSet } from "../../../lib/storage";
import { LatestMessage } from "../LatestMessage/LatestMessage";
import { Leaderboard } from "../Leaderboard/Leaderboard";
import { SponsorCarousel } from "../SponsorCarousel/SponsorCarousel";
import { CookieControl } from "../CookieControl/CookieControl";
import { MapView } from "../../../map/MapView";
import type { MapController } from "../../../map/mapController";
import type { UserLocationState } from "../../../map/userLocation";
import type { MapTheme } from "../../../map/themes";
import { resolveOfferedThemes, resolveDefaultTheme } from "../../../map/themes";
import { acquire as acquireWakeLock, release as releaseWakeLock } from "../../../map/wakeLock";
import { InfoOverlays } from "./InfoOverlays";
import { DistanceChip } from "./DistanceChip";
import { MapControls } from "./MapControls";
import { RouteDisclaimer } from "./RouteDisclaimer";
import { TrackerMenu } from "./TrackerMenu";
import { LocationPrompt } from "./LocationPrompt";

const THEME_STORAGE_KEY = "wmsfo.tracker.theme";

type MapSectionData = {
  themes?: readonly string[];
  defaultTheme?: string;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  controls?: {
    themePicker?: boolean;
    terrain?: boolean;
    snow?: boolean;
    routeLines?: boolean;
    timeLabels?: boolean;
    location?: boolean;
    dataRow?: boolean;
  };
  overlays?: {
    liveIndicator?: boolean;
    liftoffTimer?: boolean;
    latestMessage?: boolean;
    leaderboardPanel?: boolean;
    sponsorCarousel?: boolean;
    cookieControl?: boolean;
    distanceChip?: boolean;
  };
};

export const Map: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as MapSectionData;
  const offered = useMemo(() => resolveOfferedThemes(d.themes ?? null), [d.themes]);
  const stored = storageGet(THEME_STORAGE_KEY);
  const initialTheme = useMemo(
    () =>
      resolveDefaultTheme(
        stored ?? d.defaultTheme ?? null,
        offered,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offered],
  );

  const controls: Required<NonNullable<MapSectionData["controls"]>> = {
    themePicker: d.controls?.themePicker ?? false,
    terrain: d.controls?.terrain ?? false,
    snow: d.controls?.snow ?? false,
    routeLines: d.controls?.routeLines ?? true,
    timeLabels: d.controls?.timeLabels ?? true,
    location: d.controls?.location ?? false,
    dataRow: d.controls?.dataRow ?? false,
  };

  const overlays: Required<NonNullable<MapSectionData["overlays"]>> = {
    liveIndicator: d.overlays?.liveIndicator ?? true,
    liftoffTimer: d.overlays?.liftoffTimer ?? true,
    latestMessage: d.overlays?.latestMessage ?? false,
    leaderboardPanel: d.overlays?.leaderboardPanel ?? false,
    sponsorCarousel: d.overlays?.sponsorCarousel ?? false,
    cookieControl: d.overlays?.cookieControl ?? false,
    distanceChip: d.overlays?.distanceChip ?? false,
  };

  const [theme, setTheme] = useState<MapTheme>(initialTheme);
  const [mapType, setMapType] = useState<"terrain" | "roadmap">("terrain");
  const [snow, setSnow] = useState<boolean>(false);
  const [routeLines, setRouteLines] = useState<boolean>(true);
  const [timeLabels, setTimeLabels] = useState<boolean>(true);
  const [following, setFollowing] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [locationOpen, setLocationOpen] = useState<boolean>(false);
  const [controller, setController] = useState<MapController | null>(null);
  const [userState, setUserState] = useState<UserLocationState>({
    enabled: false,
    position: null,
    error: null,
    distanceMetres: null,
  });

  const route = useStore((s) => s.route);
  const snowVisible = controls.snow && snow;

  const defaultCenter = d.defaultCenter ?? { lat: 39.7392, lng: -104.9903 };
  const defaultZoom = d.defaultZoom ?? 8;

  const mapOptions = useMemo(
    () => ({
      theme,
      defaultCenter,
      defaultZoom,
      showSantaMarker: true,
      showUserLocation: controls.location,
      onFollowChange: (following: boolean) => setFollowing(following),
      onUserLocationChange: (s: UserLocationState) => setUserState(s),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void acquireWakeLock();
    const onVis = () => {
      if (!document.hidden) void acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    if (controller === null) return;
    controller.setTheme(theme);
  }, [controller, theme]);

  useEffect(() => {
    if (controller === null) return;
    controller.setMapType(mapType);
  }, [controller, mapType]);

  useEffect(() => {
    if (controller === null) return;
    controller.setToggles({ routeLines, timeLabels });
  }, [controller, routeLines, timeLabels]);

  useEffect(() => {
    if (controller === null) return;
    controller.setRoute(route);
    // No santa marker until a fix: fit the route on load.
    controller.fitRoute();
  }, [controller, route]);

  const prevSeqRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (controller === null) return;
    function apply() {
      const s = store.getState();
      const liveState = selectLiveState(s, performance.now());
      const pos =
        s.live !== null && s.live.lat !== null && s.live.lng !== null
          ? { lat: s.live.lat, lng: s.live.lng }
          : null;
      const seqChanged = s.live !== null && s.live.seq !== prevSeqRef.current;
      controller?.setLiveFix(liveState, pos, seqChanged);
      prevSeqRef.current = s.live?.seq ?? null;
    }
    apply();
    return store.subscribe(apply);
  }, [controller]);

  const onThemeChange = useCallback(
    (key: string) => {
      const next = offered.find((t) => t.key === key);
      if (next === undefined) return;
      setTheme(next);
      storageSet(THEME_STORAGE_KEY, next.key);
    },
    [offered],
  );

  const onEnableLocation = useCallback(() => {
    void controller?.enableUserLocation();
  }, [controller]);

  const onDisableLocation = useCallback(() => {
    controller?.disableUserLocation();
    setLocationOpen(false);
  }, [controller]);

  useEffect(() => {
    if (userState.error === 1) setLocationOpen(true);
  }, [userState.error]);

  return (
    <div className="map-section" data-testid="map-section">
      <MapView
        options={mapOptions}
        onController={setController}
        className="map-section__view"
      >
        {({ error, retry }) =>
          error !== null ? (
            <MapUnavailable onRetry={retry} />
          ) : (
            <>
              <div className="map-section__top-overlays">
                <InfoOverlays
                  showLiveIndicator={overlays.liveIndicator}
                  showLiftoffTimer={overlays.liftoffTimer}
                />
              </div>
              {overlays.latestMessage ? (
                <div className="map-section__message-overlay">
                  <LatestMessage
                    data={{ style: "ticker" }}
                    items={[]}
                    bundle={bundle}
                  />
                </div>
              ) : null}
              {overlays.distanceChip ? (
                <div className="map-section__distance-overlay">
                  <DistanceChip distanceMetres={userState.distanceMetres} />
                </div>
              ) : null}
              <div className="map-section__side-controls">
                <MapControls
                  following={following}
                  onRecenter={() => {
                    const live = store.getState().live;
                    const pos =
                      live !== null && live.lat !== null && live.lng !== null
                        ? { lat: live.lat, lng: live.lng }
                        : null;
                    controller?.recenter(pos);
                  }}
                  onZoomIn={() => controller?.zoomBy(1)}
                  onZoomOut={() => controller?.zoomBy(-1)}
                />
              </div>
              {overlays.leaderboardPanel ? (
                <div className="map-section__leaderboard-overlay">
                  <Leaderboard
                    data={{ variant: "panel" }}
                    items={[]}
                    bundle={bundle}
                  />
                </div>
              ) : null}
              {overlays.sponsorCarousel ? (
                <div className="map-section__sponsor-overlay">
                  <SponsorCarousel
                    data={{ logoWidth: 480 }}
                    items={[]}
                    bundle={bundle}
                  />
                </div>
              ) : null}
              {overlays.cookieControl ? (
                <div className="map-section__cookie-overlay">
                  <CookieControl data={{}} items={[]} bundle={bundle} />
                </div>
              ) : null}
              <button
                type="button"
                className="map-section__menu-button"
                aria-label="Tracker menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                Tracker
              </button>
              <TrackerMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                controls={controls}
                themes={offered}
                themeKey={theme.key}
                onThemeChange={onThemeChange}
                mapType={mapType}
                onMapTypeChange={setMapType}
                snow={snow}
                onSnowChange={setSnow}
                routeLines={routeLines}
                onRouteLinesChange={setRouteLines}
                timeLabels={timeLabels}
                onTimeLabelsChange={setTimeLabels}
                onOpenLocation={() => setLocationOpen(true)}
                distanceMetres={userState.distanceMetres}
              />
              <LocationPrompt
                open={locationOpen}
                enabled={userState.enabled}
                errorCode={userState.error}
                onClose={() => setLocationOpen(false)}
                onEnable={onEnableLocation}
                onDisable={onDisableLocation}
              />
              <RouteDisclaimer />
              {snowVisible ? <div className="map-section__snow" aria-hidden /> : null}
            </>
          )
        }
      </MapView>
    </div>
  );
};

function MapUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="map-section__unavailable"
      role="alert"
      data-testid="map-unavailable"
    >
      <p>{copy.map.unavailable}</p>
      <button type="button" onClick={onRetry}>
        {copy.map.retry}
      </button>
    </div>
  );
}
