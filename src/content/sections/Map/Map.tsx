// docs/site.md sections 7.6 and 8. The live screen, laid out as the legacy
// tracker: the map fills the viewport; pills top-left (live state, airborne
// time, distance, instruments, the message ticker); the tracker menu button
// and the cookie panel top-right; the cookie pill and the sponsor tile
// bottom-left; zoom while following and recenter after a drag bottom-right.
// While the event is live the section is fixed to the viewport and nothing
// else on the site renders.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SectionComponent } from "../../registry";
import { store, useStore } from "../../../store/useStore";
import { selectLiveState } from "../../../store/liveState";
import { selectTakeover } from "../../selectPage";
import { storageGet, storageSet } from "../../../lib/storage";
import { setSnowOverride, useSnowEnabled } from "../../theme/seasonalLayers";
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
import type { Snapshot } from "../../../contracts";
import { copy } from "../../../copy/copy";
import { FixStatus } from "./InfoOverlays";
import { LiveIndicator } from "./LiveIndicator";
import { LiftoffTimer } from "./LiftoffTimer";
import { LiveStrip } from "./LiveStrip";
import { DistanceChip } from "./DistanceChip";
import { MapControls } from "./MapControls";
import { RouteDisclaimer } from "./RouteDisclaimer";
import { TrackerMenu } from "./TrackerMenu";
import { LocationPrompt } from "./LocationPrompt";
import { ChevronGlyph, TrackerMenuGlyph } from "./glyphs";
import * as styles from "./Map.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";
import * as btn from "../../../ui/Button.module.css";

const THEME_STORAGE_KEY = "wmsfo.tracker.theme";

type MapSectionData = {
  themes?: readonly string[];
  defaultTheme?: string;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  flightHistoryDefault?: boolean;
  controls?: {
    themePicker?: boolean;
    terrain?: boolean;
    snow?: boolean;
    flightHistory?: boolean;
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
    liveStrip?: boolean;
  };
};

type FlightHistory = NonNullable<NonNullable<Snapshot["event"]>["flightHistory"]>;
type FlightHistoryPoint = NonNullable<FlightHistory["points"]>[number];

function normalizePoints(fh: FlightHistory | null): { lat: number; lng: number; recordedAt: string | null }[] | null {
  if (fh === null) return null;
  const raw = fh.points ?? [];
  const filtered: { lat: number; lng: number; recordedAt: string | null }[] = [];
  for (const p of raw as FlightHistoryPoint[]) {
    if (typeof p.lat === "number" && typeof p.lng === "number") {
      filtered.push({
        lat: p.lat,
        lng: p.lng,
        recordedAt: p.recordedAt ?? null,
      });
    }
  }
  return filtered;
}

function isPhoneWidth(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 760px)").matches
    : false;
}

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
    flightHistory: d.controls?.flightHistory ?? true,
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
    liveStrip: d.overlays?.liveStrip ?? true,
  };

  const flightHistoryDefault = d.flightHistoryDefault === true;

  const [theme, setTheme] = useState<MapTheme>(initialTheme);
  const [mapType, setMapType] = useState<"terrain" | "roadmap">("terrain");
  const snow = useSnowEnabled(false);
  const [flightHistoryOn, setFlightHistoryOn] = useState<boolean>(flightHistoryDefault);
  const [timeLabels, setTimeLabels] = useState<boolean>(true);
  const [following, setFollowing] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(() => !isPhoneWidth());
  const [locationOpen, setLocationOpen] = useState<boolean>(false);
  const [controller, setController] = useState<MapController | null>(null);
  const [userState, setUserState] = useState<UserLocationState>({
    enabled: false,
    position: null,
    error: null,
    distanceMetres: null,
  });

  const takeover = useStore(selectTakeover);
  const flightHistory = useStore((s) => s.snapshot?.event?.flightHistory ?? null);
  const hasMessage = useStore((s) => (s.snapshot?.event?.latestMessage ?? null) !== null);
  const flightPoints = useMemo(() => normalizePoints(flightHistory as FlightHistory | null), [flightHistory]);
  const flightHistoryAvailable = flightPoints !== null;

  const defaultCenter = d.defaultCenter ?? { lat: 39.7392, lng: -104.9903 };
  const defaultZoom = d.defaultZoom ?? 8;

  const mapOptions = useMemo(
    () => ({
      theme,
      defaultCenter,
      defaultZoom,
      showSantaMarker: true,
      showUserLocation: controls.location,
      onFollowChange: (f: boolean) => setFollowing(f),
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
    controller.setToggles({
      flightHistory: flightHistoryOn && flightHistoryAvailable,
      timeLabels,
    });
  }, [controller, flightHistoryOn, flightHistoryAvailable, timeLabels]);

  useEffect(() => {
    if (controller === null) return;
    controller.setFlightHistory(flightPoints);
  }, [controller, flightPoints]);

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

  // The tracker follows the map style, not the site's scheme (8.4): the
  // section rebinds the surface tokens to the theme's chrome so every pill,
  // panel, tile, button, and dialog inside it takes the theme's colours.
  const chromeStyle = useMemo<CSSProperties>(() => {
    const c = theme.chrome;
    return {
      "--panel": c.bg,
      "--panel-2": c.tile,
      "--text": c.fg,
      "--text-dim": c.fg,
      "--text-bright": c.text,
      "--line": `color-mix(in srgb, ${c.fg} 30%, transparent)`,
      "--accent": c.accent,
      "--accent-soft": `color-mix(in srgb, ${c.accent} 18%, transparent)`,
      "--tracker-panel": c.panel,
      "--tracker-tile-fg": c.tileFg,
      "--shadow": "0 1px 4px rgba(0, 0, 0, 0.3)",
    } as CSSProperties;
  }, [theme]);

  const rootClass = [
    styles.mapSection,
    takeover ? styles.mapSectionTakeover : "",
    menuOpen ? styles.menuOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} style={chromeStyle} data-testid="map" data-theme-key={theme.key} data-takeover={takeover ? "live" : undefined}>
      <MarkerSeqHost />
      <MapView
        options={mapOptions}
        onController={setController}
      >
        {({ error, retry }) =>
          error !== null ? (
            <MapUnavailable onRetry={retry} />
          ) : (
            <>
              <div className={styles.topLeft}>
                {overlays.liveIndicator ? <LiveIndicator /> : null}
                <FixStatus />
                {overlays.liftoffTimer ? <LiftoffTimer /> : null}
                {overlays.distanceChip ? <DistanceChip distanceMetres={userState.distanceMetres} /> : null}
                {overlays.liveStrip ? <LiveStrip /> : null}
                {overlays.latestMessage && hasMessage ? (
                  <div className={styles.messageOverlay}>
                    <LatestMessage
                      data={{ style: "ticker" }}
                      items={[]}
                      bundle={bundle}
                    />
                  </div>
                ) : null}
              </div>

              <div className={styles.topRight}>
                <button
                  type="button"
                  className={`${ibtn.ibtn} ${styles.menuButton}`}
                  aria-label={copy.map.trackerMenu}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <TrackerMenuGlyph size={22} />
                </button>
                {overlays.leaderboardPanel ? (
                  <div className={styles.leaderboardOverlay} data-testid="leaderboard-panel">
                    <button
                      type="button"
                      className={styles.leaderboardHead}
                      aria-expanded={leaderboardOpen}
                      onClick={() => setLeaderboardOpen((v) => !v)}
                    >
                      <span>Cookies</span>
                      <ChevronGlyph size={16} />
                    </button>
                    {leaderboardOpen ? (
                      <div className={styles.leaderboardBody}>
                        <Leaderboard
                          data={{ variant: "panel", compact: true }}
                          items={[]}
                          bundle={bundle}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className={styles.bottomLeft}>
                {overlays.cookieControl ? (
                  <div className={styles.cookieOverlay}>
                    <CookieControl data={{ compact: true }} items={[]} bundle={bundle} />
                  </div>
                ) : null}
                {overlays.sponsorCarousel ? (
                  <div className={styles.sponsorOverlay}>
                    <SponsorCarousel
                      data={{ logoWidth: 480, variant: "tile" }}
                      items={[]}
                      bundle={bundle}
                    />
                  </div>
                ) : null}
              </div>

              <div className={styles.bottomRight}>
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
                onSnowChange={setSnowOverride}
                flightHistoryAvailable={flightHistoryAvailable}
                flightHistory={flightHistoryOn}
                onFlightHistoryChange={setFlightHistoryOn}
                timeLabels={timeLabels}
                onTimeLabelsChange={setTimeLabels}
                onFitHistory={() => controller?.fitHistory()}
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
            </>
          )
        }
      </MapView>
    </div>
  );
};

function MarkerSeqHost() {
  const seq = useStore((s) => s.live?.seq ?? null);
  const hasFix = useStore(
    (s) => s.live !== null && s.live.lat !== null && s.live.lng !== null,
  );
  if (!hasFix || seq === null) return null;
  return <div data-testid="marker-seq" data-seq={seq} hidden aria-hidden />;
}

function MapUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className={styles.unavailable}
      role="alert"
      data-testid="map-unavailable"
    >
      <p>{copy.map.unavailable}</p>
      <button type="button" className={btn.btn} onClick={onRetry}>
        {copy.map.retry}
      </button>
    </div>
  );
}
