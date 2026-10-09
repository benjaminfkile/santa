// docs/site.md sections 7.6 and 8. The live screen, laid out as the legacy
// tracker: the map fills the viewport; pills top-left (live state with the
// viewers, the airborne time, the distance from Santa, the fix status, and
// the messages pill last); the tracker menu button,
// the bare cookie tally, and the leave-a-cookie glyph top-right; the flight
// data dock's handle pill (while collapsed) above the sponsor tile
// bottom-left; zoom while following and recenter after a drag bottom-right;
// the flight data dock across the bottom while open, lifting both bottom
// stacks above it.
// While the event is live the section is fixed to the viewport and nothing
// else on the site renders.
// The map styles are the event's enabled Google themes from the snapshot's
// `trackerThemes` (8.4); the map is locked to `event.trackerBbox` (8.2).
// The renderer choice of 8.1 is made and reported as the `live` surface on
// mount; the section builds the Google controller whatever the answer.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import type { SectionComponent } from "../../registry";
import { useAuth } from "../../../auth/AuthProvider";
import { store, useStore } from "../../../store/useStore";
import { selectLiveState } from "../../../store/liveState";
import { selectTakeover } from "../../selectPage";
import { storageSet } from "../../../lib/storage";
import { describeError } from "../../../lib/analytics";
import { setSnowOverride, useSnowEnabled } from "../../theme/seasonalLayers";
import { SponsorCarousel } from "../SponsorCarousel/SponsorCarousel";
import { CookieDialog } from "../CookieControl/CookieControl";
import { MapView } from "../../../map/MapView";
import type { MapController } from "../../../map/mapController";
import type { UserLocationState } from "../../../map/userLocation";
import type { MapTheme } from "../../../map/themes";
import {
  loadThemes,
  resolveInitialTheme,
  themesFor,
  THEME_STORAGE_KEY,
} from "../../../map/themes";
import { toBbox } from "../../../map/bounds";
import { reportRenderer } from "../../../map/renderer";
import { resolvePoiKinds } from "../../../map/poiStyles";
import { acquire as acquireWakeLock, release as releaseWakeLock } from "../../../map/wakeLock";
import type { MountIcon, TrackerViewpoint } from "../../../map/viewpointsOverlay";
import type { IconRef, Snapshot } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Icon, iconResolves } from "../../primitives/Icon";
import { resolvePlaces, resolveViewpoints } from "../RoutePreview/routeMapConfig";
import { copy } from "../../../copy/copy";
import { AirbornePill, DistancePill, FixStatus } from "./InfoOverlays";
import { LiveIndicator } from "./LiveIndicator";
import { MessagesPill } from "./MessagesPill";
import { FlightGauge } from "./FlightGauge";
import { MapControls } from "./MapControls";
import { RouteDisclaimer } from "./RouteDisclaimer";
import { TrackerMenu } from "./TrackerMenu";
import { LocationPrompt } from "./LocationPrompt";
import { MapUnavailable } from "./MapUnavailable";
import { readTrackerToggle, writeTrackerToggle } from "./trackerToggles";
import { CookieTally } from "./CookieTally";
import { CookiePlusGlyph, TrackerMenuGlyph } from "./glyphs";
import * as styles from "./Map.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";

type MapSectionData = {
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
    landmarks?: boolean;
  };
  overlays?: {
    liveIndicator?: boolean;
    liftoffTimer?: boolean;
    latestMessage?: boolean;
    leaderboardPanel?: boolean;
    sponsorCarousel?: boolean;
    cookieControl?: boolean;
    distanceChip?: boolean;
    onlineCount?: boolean;
    flightDock?: boolean;
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

// The site settings' viewpoints for the tracker, each icon kept only when it
// draws, so a viewpoint whose icon does not resolve shows the dot.
function trackerViewpoints(list: unknown, bundle: ContentBundle): TrackerViewpoint[] {
  return (resolveViewpoints(list) ?? []).map((l) =>
    l.icon && !iconResolves(l.icon, bundle) ? { ...l, icon: null } : l,
  );
}

// The site's effective appearance: the root's `data-theme`, dark or light.
function readAppearance(): "light" | "dark" {
  return typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export const Map: SectionComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as MapSectionData;
  const trackerThemes = useStore((s) => s.snapshot?.trackerThemes ?? null);
  const trackerBbox = useStore((s) => s.snapshot?.event?.trackerBbox ?? null);
  const themes = useMemo(() => loadThemes({ trackerThemes: trackerThemes ?? [] }), [trackerThemes]);
  const offered = useMemo(() => themesFor(themes, "google"), [themes]);
  const [initialTheme] = useState<MapTheme | null>(() =>
    resolveInitialTheme(themes, "google", readAppearance()),
  );

  useEffect(() => {
    const s = store.getState().snapshot;
    reportRenderer("live", s);
  }, []);

  const controls: Required<NonNullable<MapSectionData["controls"]>> = {
    themePicker: d.controls?.themePicker ?? false,
    terrain: d.controls?.terrain ?? false,
    snow: d.controls?.snow ?? false,
    flightHistory: d.controls?.flightHistory ?? true,
    timeLabels: d.controls?.timeLabels ?? true,
    location: d.controls?.location ?? false,
    dataRow: d.controls?.dataRow ?? false,
    landmarks: d.controls?.landmarks ?? true,
  };

  const overlays: Required<NonNullable<MapSectionData["overlays"]>> = {
    liveIndicator: d.overlays?.liveIndicator ?? true,
    liftoffTimer: d.overlays?.liftoffTimer ?? true,
    latestMessage: d.overlays?.latestMessage ?? false,
    leaderboardPanel: d.overlays?.leaderboardPanel ?? false,
    sponsorCarousel: d.overlays?.sponsorCarousel ?? false,
    cookieControl: d.overlays?.cookieControl ?? false,
    distanceChip: d.overlays?.distanceChip ?? false,
    onlineCount: d.overlays?.onlineCount ?? true,
    flightDock: d.overlays?.flightDock ?? true,
  };

  const flightHistoryDefault = d.flightHistoryDefault === true;

  // The Google-supplied places the map shows, from the site settings'
  // `places.tracker`: every kind the theme keeps while it is absent, only
  // the known kinds in its `kinds` while it is present.
  const settingsPlaces = bundle.content?.settings?.places;
  const poiFilter = useMemo(() => {
    const tracker = resolvePlaces(settingsPlaces).tracker;
    return tracker === undefined ? null : { kinds: resolvePoiKinds(tracker) };
  }, [settingsPlaces]);

  const [theme, setTheme] = useState<MapTheme | null>(initialTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [mapType, setMapType] = useState<"terrain" | "roadmap">("terrain");
  const snow = useSnowEnabled(false);
  // The viewer's choice outlives a remount; the content default applies
  // until the viewer has toggled (trackerToggles.ts).
  const [flightHistoryOn, setFlightHistoryOnState] = useState<boolean>(() =>
    readTrackerToggle("flightHistory", flightHistoryDefault),
  );
  const [timeLabels, setTimeLabelsState] = useState<boolean>(() =>
    readTrackerToggle("timeLabels", true),
  );
  const [viewpointsOn, setViewpointsOnState] = useState<boolean>(() =>
    readTrackerToggle("landmarks", true),
  );
  const setViewpointsOn = useCallback((v: boolean) => {
    writeTrackerToggle("landmarks", v);
    setViewpointsOnState(v);
  }, []);
  const setFlightHistoryOn = useCallback((v: boolean) => {
    writeTrackerToggle("flightHistory", v);
    setFlightHistoryOnState(v);
  }, []);
  const setTimeLabels = useCallback((v: boolean) => {
    writeTrackerToggle("timeLabels", v);
    setTimeLabelsState(v);
  }, []);
  const [flightDockOn, setFlightDockOnState] = useState<boolean>(() =>
    readTrackerToggle("flightDock", true),
  );
  // Open by default above 760 px, collapsed to the handle pill below.
  const setFlightDockOn = useCallback((v: boolean) => {
    writeTrackerToggle("flightDock", v);
    setFlightDockOnState(v);
  }, []);
  const [following, setFollowing] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [cookieOpen, setCookieOpen] = useState<boolean>(false);
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
  const isLive = useStore((s) => s.live?.eventStatusId === 3);
  const showLeave = overlays.cookieControl && isLive;
  // A visitor who is not signed in gets the button all the same: pressing it
  // opens the dialog that asks them to sign in, so the label says that rather
  // than promising something the press does not do.
  const { state: authState } = useAuth();
  const leaveLabel =
    authState.status === "signedOut" ? copy.cookies.signInToLeave : copy.cookies.leave;
  const settingsViewpoints = bundle.content?.settings?.landmarks;
  const viewpoints = useMemo(
    () => trackerViewpoints(settingsViewpoints, bundle),
    [settingsViewpoints, bundle],
  );
  const flightPoints = useMemo(() => normalizePoints(flightHistory as FlightHistory | null), [flightHistory]);
  const flightHistoryAvailable = flightPoints !== null;
  const flightDockAvailable = overlays.flightDock;
  const showGauge = flightDockAvailable && flightDockOn && !menuOpen;
  const shownDistance =
    overlays.distanceChip &&
    userState.enabled &&
    userState.distanceMetres !== null &&
    Number.isFinite(userState.distanceMetres)
      ? userState.distanceMetres
      : null;

  // Viewpoint icons render through the Icon primitive into the overlay's
  // badge, each in its own root, against the latest bundle.
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const mountIcon = useCallback<MountIcon>((container: HTMLElement, icon: IconRef) => {
    const root = createRoot(container);
    root.render(<Icon icon={icon} bundle={bundleRef.current} decorative size={18} />);
    return () => queueMicrotask(() => root.unmount());
  }, []);

  const defaultCenter = d.defaultCenter ?? { lat: 39.7392, lng: -104.9903 };
  const defaultZoom = d.defaultZoom ?? 8;

  const mapOptions = useMemo(
    () => ({
      theme,
      bbox: toBbox(trackerBbox),
      defaultCenter,
      defaultZoom,
      showSantaMarker: true,
      showUserLocation: controls.location,
      mountIcon,
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

  // A rebuilt controller starts from the theme it was built with; the
  // viewer's current choice is applied over it.
  useEffect(() => {
    if (controller === null || themeRef.current === null) return;
    controller.setTheme(themeRef.current).catch((error: unknown) => {
      console.warn("map: the style did not load", error);
    });
  }, [controller]);

  useEffect(() => {
    if (controller === null) return;
    controller.setPois(poiFilter);
  }, [controller, poiFilter]);

  useEffect(() => {
    if (controller === null) return;
    controller.setMapType(mapType);
  }, [controller, mapType]);

  useEffect(() => {
    if (controller === null) return;
    controller.setToggles({
      flightHistory: flightHistoryOn && flightHistoryAvailable,
      timeLabels,
      landmarks: viewpointsOn,
    });
  }, [controller, flightHistoryOn, flightHistoryAvailable, timeLabels, viewpointsOn]);

  useEffect(() => {
    if (controller === null) return;
    controller.setViewpoints(viewpoints);
  }, [controller, viewpoints]);

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

  // The switch waits for the controller to apply the new style, so the
  // chrome changes with the map.
  const onThemeChange = useCallback(
    async (key: string) => {
      const next = offered.find((t) => t.key === key);
      if (next === undefined) return;
      try {
        await controller?.setTheme(next);
      } catch (error) {
        console.warn("map: the style did not load", error);
        return;
      }
      storageSet(THEME_STORAGE_KEY, next.key);
      setTheme(next);
    },
    [offered, controller],
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
  const chromeStyle = useMemo<CSSProperties | undefined>(() => {
    if (theme === null) return undefined;
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

  const bottomLeftClass = styles.bottomLeft;
  const bottomRightClass = styles.bottomRight;

  const rootClass = [
    styles.mapSection,
    takeover ? styles.mapSectionTakeover : "",
    menuOpen ? styles.menuOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass}
      style={chromeStyle}
      data-testid="map"
      data-theme-key={theme?.key}
      data-takeover={takeover ? "live" : undefined}
      data-flight-history={flightHistoryOn && flightHistoryAvailable ? "on" : "off"}
    >
      <MarkerSeqHost />
      <MapView
        options={mapOptions}
        onController={setController}
      >
        {({ error }) =>
          error !== null ? (
            <MapUnavailable reason={describeError(error)} />
          ) : (
            <>
              <div className={styles.topLeft}>
                {overlays.liveIndicator ? <LiveIndicator showCount={overlays.onlineCount} /> : null}
                {overlays.liftoffTimer ? <AirbornePill /> : null}
                {shownDistance !== null ? <DistancePill metres={shownDistance} /> : null}
                <FixStatus />
                {/* The messages pill is last in the stack, whatever else is in it. */}
                {overlays.latestMessage ? <MessagesPill bundle={bundle} /> : null}
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
                {overlays.leaderboardPanel && !menuOpen ? <CookieTally bundle={bundle} /> : null}
                {showLeave && !menuOpen ? (
                  <button
                    type="button"
                    className={styles.cookieLeave}
                    aria-label={leaveLabel}
                    title={leaveLabel}
                    data-testid="cookie-tally-leave"
                    onClick={() => setCookieOpen(true)}
                  >
                    <CookiePlusGlyph size={26} />
                  </button>
                ) : null}
              </div>

              <div className={bottomLeftClass} data-testid="map-bottom-left">
                {showGauge ? <FlightGauge /> : null}
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

              <div className={bottomRightClass} data-testid="map-bottom-right">
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
                themeKey={theme?.key ?? ""}
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
                viewpointsAvailable={viewpoints.length > 0}
                viewpoints={viewpointsOn}
                onViewpointsChange={setViewpointsOn}
                flightDockAvailable={flightDockAvailable}
                flightDock={flightDockOn}
                onFlightDockChange={setFlightDockOn}
                onOpenLocation={() => setLocationOpen(true)}
                locationEnabled={userState.enabled}
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
              {showLeave && cookieOpen ? (
                <CookieDialog bundle={bundle} onClose={() => setCookieOpen(false)} />
              ) : null}
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
