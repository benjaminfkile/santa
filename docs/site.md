# WMSFO v2 public site: technical design

The public site is a static single-page application: Vite, React 19, TypeScript, deployed on Vercel. It reads three JSON objects, media, and icons from the CDN (plus one API read for the panel's preview frame), listens to one hub channel, and performs exactly three kinds of authenticated write (`POST /cookies`, the `/me/subscriptions` family, and nothing else) plus the three anonymous POSTs (`/contact`, `/subscriptions/verify`, `/subscriptions/unsubscribe`). It never calls the API for a read. Every name and shape below is the one in the shared contracts; where this document says "contracts 1.2" it means that section of the contracts document.

Visual design is a separate track. This document covers structure and behaviour only.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Build | Vite 8, `@vitejs/plugin-react`, TypeScript strict, ES2020 target; `oxlint` for linting |
| UI | React 19, `react-router-dom` v7 (browser router) |
| Store | One framework-free module (`src/store`), exposed to React through `useSyncExternalStore` |
| Realtime | `@microsoft/signalr`, WebSockets only, negotiation skipped, dynamic import |
| Map | Google Maps JavaScript API through `@googlemaps/js-api-loader`, dynamic import |
| Auth | The site's own pages over the Cognito Identity Provider API through `amazon-cognito-identity-js` (SRP sign-in, sign-up, confirmation, password reset, refresh), dynamic import; no hosted UI, no redirect |
| Types | Generated from the vendored `contracts/` folder: `openapi-typescript` for REST, `json-schema-to-typescript` for the CDN objects |
| Tests | Vitest + Testing Library for units and the status switch; Playwright for the preview site |
| Hosting | One Vercel project, git-integrated: `main` is Production at `https://<site-domain>`, `dev` is the Preview branch at `https://<preview-site-domain>` |
| Package manager | npm, lockfile committed, Node 22 |

No server functions, no service worker, no server rendering.

---

## 2. Project structure

```
santa/
  index.html                      CSP meta and preconnect built from VITE_ values at build time
  vite.config.ts
  vercel.json                     SPA rewrite and static headers (section 21)
  package.json
  tsconfig.json
  .env.example                    every VITE_ key with a placeholder value
  contracts/                      vendored copy of the API repo's contracts/ folder
  CONTRACTS_SHA                   API commit the copy came from
  public/
    favicon.svg, robots.txt, manifest.webmanifest
  src/
    main.tsx                      env validation, analytics gate, store start, render
    app/
      App.tsx                     router, error boundary, shell
      routes.tsx                  route table (section 4)
      Shell.tsx                   nav menu, sign-in link, banners (updates paused, offline, preview), footer
      HeaderLinks.tsx             the header link buttons from settings.headerLinks, first in the actions row (section 7.7)
      PriorityNav.tsx             the inline nav above 760 px with its More menu (section 7.7)
      navOverflow.ts              the More menu's collapse math
    config/
      env.ts                      typed, validated import.meta.env
    contracts/
      generated/                  types generated from ../../contracts (checked in)
      index.ts                    LiveObject, Snapshot, Sponsor, CookieType, ApiError re-exports
    store/
      store.ts                    createStore, getState, subscribe, select
      types.ts                    Store (contracts 1.9) and Diagnostics
      applyLive.ts                shouldReplace, applyLive (pure)
      liveState.ts                selectLiveState, selectTimeReady (pure)
      cadence.ts                  isHubQuiet, pollCadenceMs (pure)
      loop.ts                     startDataLoop: startup, poll timer, visibility, URL changes
      fetchers.ts                 fetchLive, fetchSnapshot (schemaVersion check)
      hub.ts                      startHub: connection, join, ack, evictions, reconnect
      backoff.ts                  1 s, 2 s, 3 s, then 5 s forever
      useStore.ts                 React binding and selectors
    auth/
      cognito.ts                  amazon-cognito-identity-js wrapper (lazy): signUp, confirm, resend, signIn (SRP), forgot, reset, refresh, revoke, current session
      session.ts                  token storage (localStorage), expiry, getIdToken with refresh
      getIdToken.ts               re-exports the bearer for API calls (section 11.4)
      errors.ts                   Cognito error names to site copy
      AuthProvider.tsx            auth state for React, sign-out
    alerts/
      AlertsProvider.tsx          useAlerts: the signed-in visitor's subscriptions and alerts, the unread count, markSeen (section 7.7)
      AlertsBell.tsx              the header's alerts bell, its badge and swing, BellGlyph
      AlertsDialog.tsx            the alerts dialog on the shared dialog recipe
      alertId.ts                  an alert's id as a number
      Alerts.module.css           the bell's badge and swing, the dialog's rows
    api/
      client.ts                   fetch wrapper: bearer, error shape, timeouts
      errors.ts                   ApiRequestError, code to copy mapping
      cookies.ts                  GET /me/cookies, POST /cookies
      subscriptions.ts            /me/subscriptions family, verify, unsubscribe
      contact.ts                  POST /contact
      preview.ts                  GET /preview/document
      qr.ts                       the scan beacon (section 4)
    content/
      registry.ts                 kind to component map (sections) and block kind to component map; the only wiring point
      PageRenderer.tsx            page = section stack; SectionFrame applies presentation
      SectionFrame.tsx            width, align, background (token or media), spacing, decoration icons, anchor
      selectPage.ts               role or slug to ContentPage (pure)
      nav.ts                      nav entries from pages and settings (pure)
      inline/                     parse.ts (the inline grammar), Inline.tsx (React renderer), placeholders.ts
      blocks/                     Heading, Paragraph, List, Quote, Media, Links, Icon, Divider
      primitives/                 Icon.tsx (library or media, <img>), Media.tsx (srcset), LinkView.tsx, StatusPill.tsx, resolve.ts
      icons/generated/            the icon library as components, written by scripts/gen-icons.mjs from contracts/icons
      sections/
        RichText/  Hero/  MediaGallery/  Links/  IconRow/  Divider/
        FundsRing/  Countdown/  EventTimes/  LatestMessage/  Leaderboard/
        SponsorCarousel/  SponsorGrid/  RoutePreview/  CookieControl/  AlertsSignup/  ContactForm/
        Map/                      Map.tsx (the live screen: full-viewport map plus overlays), TrackerMenu.tsx, InfoOverlays.tsx,
                                  LiveIndicator.tsx, MessagesPill.tsx, MessagesDialog.tsx, FlightGauge.tsx, MapControls.tsx, RouteDisclaimer.tsx, LocationPrompt.tsx, glyphs.tsx,
                                  trackerToggles.ts, gauges/ (the flight gauge's three instruments and their slot contract, types.ts)
        Unknown.tsx               renders nothing, logs once per kind
      theme/                      tokens.css (the only file with a colour literal), colorScheme.ts (light/dark/system), favicon.ts, Frost.module.css,
                                  seasonalLayers.tsx (snow and lights), OrnamentsLayer.tsx
    pages/
      HomePage.tsx                the role page for live.eventStatusId
      SlugPage.tsx                the none page for /:slug, or NotFound
      PreviewPage.tsx             /preview: fetches the bundle, renders the named page
      QrPage.tsx                  /q/:tag (section 4)
      Loading.tsx  ReloadPrompt.tsx  NotFound.tsx
      Alerts/                     VerifyPage.tsx, UnsubscribePage.tsx (token landing pages)
      Auth/                       SignInPage, SignUpPage, ConfirmPage, ForgotPasswordPage, ResetPasswordPage (section 11), each a themed form in AuthCard on the site's own shell; returnTo.ts, pendingSignUp.ts
    ui/                           the shared recipes as CSS modules: Button, IconButton, Field, Dialog

    map/                          the renderer choice, the theme loader, and the Google tracker (section 8); imported through import() by sections/Map and, in route mode on Google, by sections/RoutePreview
      renderer.ts                 pickRenderer and canUseWebGl2: the renderer choice and the WebGL 2 probe (8.1)
      loadMaps.ts                 Loader singleton, importLibrary("maps" | "marker" | "geometry")
      MapView.tsx                 React host for the map element
      mapController.ts            the controller interface (8.3) and its Google implementation: follow, recenter, zoom, mapType, theme
      santa-pin.png               the legacy Santa pin (100 x 192, tip at the bottom centre)
      santaPin.ts                 the pin asset's URL and its img element (in the `theme` chunk)
      santaMarker.ts              the Santa marker: the pin image in an OverlayView, with the signal-lost filter
      flightHistoryOverlay.ts     polyline, arrows, time labels (the previous flight from the snapshot)
      userLocation.ts             watchPosition, user marker, dotted line, distance
      themes/                     index.ts: the loader over snapshot.trackerThemes (8.4)
      wakeLock.ts
    mapHost/                      the MapLibre map host (8.10): route mode for sections/RoutePreview, live mode for sections/Map; imported through import()
      MapHost.tsx                 React host: the mode, the theme style, bounds, terrain, fullscreen, the runtime fallback to Google
      maplibreController.ts       the MapLibre implementation of the controller interface (8.3)
      themeStyle.ts               injects the event's map sources, the glyph template, and the sprite into a theme's style; drops the terrain layers without a terrain file
      bounds.ts                   the event box as the pan limit and the fitted minimum zoom (8.2)
      places.ts                   the nine-kind map and the filter on the theme's wmsfo:places layers
      routeLayers.ts              the path, marks, arrows, time labels, and viewpoint dots as GeoJSON sources and layers over the theme's style
      pins.ts                     the start marker, the viewpoint badges and popovers, the Santa marker, and the user location as HTML markers
      maplibre.css                the part of MapLibre's stylesheet the host uses, on the site's tokens
    copy/
      copy.ts                     the few site-coded strings (loading, errors, sign-in hint, not found, the alerts bell and its dialog under `alerts`); everything else is content
    lib/
      time.ts                     formatCountdown, formatElapsed, formatEventTime, formatClock
      useNow.ts                   a ticking clock for React
      units.ts                    mpsToMph, metresToFeet, metresToMiles, headingToCardinal
      motion.ts                   prefersReducedMotion, useReducedMotion
      inAppBrowser.ts
      storage.ts                  guarded localStorage get/set
      messageSeen.ts              the read mark of the event's latest message, `wmsfo.messages.seen.<eventId>`, with in-page listeners
      analytics.ts
  tests/
    unit/                         Vitest, mirrors src/
    e2e/                          Playwright: specs/, harness/, fixtures/
  .github/workflows/
    ci.yml                        typecheck, lint, unit, build, contracts check, size budget
    e2e.yml                       Playwright against the preview site after a dev deploy
```

Rules that keep the structure honest:

- Only `src/store/fetchers.ts` fetches from the CDN and only `src/api/client.ts` calls the API. Nothing else issues a network request except the Maps loader, the SignalR connection, the map host's reads of tiles, glyphs, sprites, and theme style bodies from the CDN (8.10), and the analytics script.
- `src/map/**`, `src/mapHost/**`, `maplibre-gl`, and `@microsoft/signalr` are never imported statically from anywhere; they enter through `import()` (section 18).
- The store has no dependency on auth. Auth state lives in `AuthProvider` and gates two surfaces: the `alerts_signup` section and the `cookie_control` section.
- `src/content/registry.ts` is the only place a section kind or a block kind is wired to a component. Nothing else switches on `kind`. A kind missing from the registry renders `Unknown`.
- No page layout, copy, image, or link is coded into the site beyond `copy/copy.ts`; everything the visitor reads comes from `snapshot.content`.

---

## 3. Configuration

All configuration is Vercel environment variables with the `VITE_` prefix, validated at boot by `src/config/env.ts`. A missing or malformed value renders a plain "site misconfigured" page naming the variable and stops.

| Variable | Production | Preview and local |
|---|---|---|
| `VITE_ENV` | `production` | `preview` |
| `VITE_CDN_BASE_URL` | `https://<cdn-domain>` (prod distribution) | dev distribution |
| `VITE_HUB_URL` | `wss://<gateway-domain>/hub` | same |
| `VITE_HUB_CHANNEL_PREFIX` | `wmsfo-api` | `wmsfo-api-dev` |
| `VITE_API_BASE_URL` | `https://<api-domain>` (prod) | dev API host |
| `VITE_COGNITO_USER_POOL_ID` | `<pool-id>` (the prod people pool; its `<region>_` prefix is the region) | dev people pool |
| `VITE_COGNITO_CLIENT_ID` | `<site-client-id>` (prod) | dev |
| `VITE_GOOGLE_MAPS_KEY` | referrer-restricted browser key | same key, referrers include the preview origin and `localhost:5173` |
| `VITE_ANALYTICS_ID` | GA4 measurement id | empty |
| `VITE_ANALYTICS_ORIGINS` | `https://<site-domain>` (comma-separated exact origins) | empty |

```ts
// src/config/env.ts
export const env = {
  ENV: read("VITE_ENV", /^(production|preview)$/),
  CDN_BASE_URL: readUrl("VITE_CDN_BASE_URL", "https:"),
  HUB_URL: readUrl("VITE_HUB_URL", "wss:"),
  HUB_CHANNEL_PREFIX: read("VITE_HUB_CHANNEL_PREFIX", /^[a-z0-9-]+$/),
  API_BASE_URL: readUrl("VITE_API_BASE_URL", "https:"),
  COGNITO_USER_POOL_ID: read("VITE_COGNITO_USER_POOL_ID", /^[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]+$/),
  COGNITO_CLIENT_ID: read("VITE_COGNITO_CLIENT_ID", /^[a-z0-9]+$/),
  GOOGLE_MAPS_KEY: read("VITE_GOOGLE_MAPS_KEY", /^\S+$/),
  ANALYTICS_ID: readOptional("VITE_ANALYTICS_ID"),
  ANALYTICS_ORIGINS: readOptional("VITE_ANALYTICS_ORIGINS").split(",").map(s => s.trim()).filter(Boolean),
} as const;

export const LIVE_URL = `${env.CDN_BASE_URL}/live/location.json`;
export const LOCATION_CHANNEL = `${env.HUB_CHANNEL_PREFIX}:location`;
export const COGNITO_IDP_URL = `https://cognito-idp.${env.COGNITO_USER_POOL_ID.split("_")[0]}.amazonaws.com`;   // the only Cognito host the site talks to
export const IS_PRODUCTION = env.ENV === "production";
```

Local development uses `.env.local` with the preview set and runs on `http://localhost:5173`, a hub allowed origin for dev; the CDN answers CORS for every origin and the Cognito API answers CORS for any origin, so no origin registration is needed for auth. `VITE_API_BASE_URL` is used only as the base for the writes in section 12; the site fetches `LIVE_URL` and otherwise only absolute URLs found inside CDN objects. No secrets exist in the bundle; the Maps key is referrer-restricted.

---

## 4. Routing

`BrowserRouter`; every path is served by `index.html` through the Vercel rewrite in section 21. The route table is fixed; the pages behind it are content.

| Path | Component | Chunk | Notes |
|---|---|---|---|
| `/` | `HomePage` | main (map chunk loads when the page holds a `map` section) | The page whose `role` matches `live.eventStatusId` (section 5.4) |
| `/preview` | `PreviewPage` | main | `token`, `page`, and `theme` from the query string; starts the tab's preview session and navigates with `replace` to the page's normal path (section 7.8) |
| `/alerts/verify` | `VerifyPage` | alerts | `token` from the query string |
| `/alerts/unsubscribe` | `UnsubscribePage` | alerts | `token` from the query string |
| `/auth/sign-in` | `SignInPage` | auth | `returnTo` from the query string (a site path, else `/`) |
| `/auth/sign-up` | `SignUpPage` | auth | `returnTo` carried through to the confirmation and sign-in |
| `/auth/confirm` | `ConfirmPage` | auth | `email` and `returnTo` from the query string; the six-digit code from the email |
| `/auth/forgot` | `ForgotPasswordPage` | auth | |
| `/auth/reset` | `ResetPasswordPage` | auth | `email` from the query string; the code from the email plus the new password |
| `/:slug` | `SlugPage` | main | The `none` page with that slug; a role page's slug redirects to `/` except inside a preview session, where it renders that role page whatever the event status; unknown renders `NotFound` |
| `/q/:tag` | `QrPage` | main | A printed code (contracts 4.5a): sends the scan beacon, then opens what the snapshot says |
| `*` | `NotFound` | main | Links back to `/` |

While `live.eventStatusId === 3` the router renders the `live` role page for every path; the table above applies in every other status. The only exceptions are the site-coded paths, which must keep working during the event: the five `/auth/*` pages (a visitor signs in to leave a cookie mid-flight), `/alerts/verify` and `/alerts/unsubscribe` because email links land there, and `/preview`, which starts a preview session for whatever page the panel asks for. During the takeover the auth pages render inside the takeover's dialog surface (section 11.5) so the tracker stays underneath.

**`/q/:tag`** renders nothing of its own. On mount it reads `snapshot.qrCodes[tag]` (waiting for the first snapshot when the store has none yet), sends one scan beacon, a `fetch` of `${API}/qr-codes/${tag}/scans` with JSON `{ referrer: document.referrer }`, `keepalive: true`, and `credentials: "omit"` (a keepalive fetch survives the navigation like `sendBeacon` would, and without credentials its preflight passes the wildcard origin the edge answers with, which a credentialed `sendBeacon` cannot), then navigates with `replace`: to `/<pageSlug>` (`/` for the home page), to `forwardUrl` through `window.location.replace` (the one-second hop is accepted), or to `/` when the tag is absent. The beacon is sent before the navigation so a forward never cancels it. While live, the live page takes over like every other path after the beacon. A tag is `qr-` and digits; anything else is `NotFound` without a beacon.

Route-level `lazy()` with a `Suspense` fallback for the `alerts` and `auth` chunks. The shell (nav menu, banners, footer) wraps every route; on a page whose first section is `map` the shell renders only its menu button and banners over the map and no footer.

Menu entries come from `content/nav.ts`: the home entry (`settings.homeNavLabel`, `/`), then every non-hidden `none` page with a `navLabel` in `navPosition` order, then `settings.navExtraLinks`, then Sign out when signed in or Sign in when signed out. Each entry carries the icon the menu panel draws in its row (7.7). The sign-in entry is a plain link-styled button; nothing else on the site references accounts except the two sections that need one.

---


---

## 5. The store

**Numbers.** One format for every number the tracker shows, `formatCount` in `src/lib/number.ts`. Under a thousand the number reads as itself ("999"); from a thousand up it is abbreviated to one decimal with a trailing ".0" dropped, so 1000 is "1k", 1100 is "1.1k", 4120 is "4.1k" and 12,345 is "12.3k", then "M" and "B" for the larger units. Rounding that would reach the next unit carries into it, so 999,950 is "1M" and never "1000k"; a negative keeps its sign; a value that is not finite returns an empty string and the caller decides what to show. Nothing on the live screen uses a thousands separator any more. It covers the cookie tally and the leaderboard counts, the cookie dialog's per-type tally, the watching count on the live pill, the distance from Santa (feet, and miles past a thousand, the exact two decimals below that), and the dock's speed, altitude and accuracy. `formatCountWithUnit(value, unit)` is the same thing with a unit after it.

### 5.1 Shape

The store holds exactly the contract's `Store` (contracts 1.9) plus a `diag` object for connectivity indicators. Nothing in `diag` influences which screen renders.

```ts
// src/store/types.ts
import type { LiveObject, Snapshot } from "../contracts";

export type Store = {
  live: LiveObject | null;
  snapshot: Snapshot | null;
  snapshotUrl: string | null;        // the URL store.snapshot was fetched from
  hub: "connecting" | "connected" | "reconnecting" | "disconnected";
                                     // "connected" is set on the `joined` ack for `<service>:location`,
                                     // not when start() resolves; start() resolving leaves it "connecting"
  lastHubLocationAt: number | null;  // performance.now() of the last hub `location` event
  lastSeqChangeAt: number | null;    // performance.now() when an applied object carried a `seq` different
                                     // from the previous one; set on the first apply too
  schemaMismatch: boolean;           // true once an unknown schemaVersion was seen
};

export type Diagnostics = {
  online: boolean;                   // navigator.onLine, kept current by the online/offline events
  lastPollOkAt: number | null;       // performance.now() of the last 200 or 304 on live/location.json
  consecutivePollFailures: number;   // reset to 0 on success
  snapshotFetchFailing: boolean;     // a wanted snapshotUrl has failed at least once and is retrying
  firstLoadStartedAt: number;        // performance.now() at startDataLoop
};

export type SiteStore = Store & { diag: Diagnostics; preview: ContentBundle | null };   // preview: set only by /preview (7.8)

export const initialStore: SiteStore = {
  live: null, snapshot: null, snapshotUrl: null,
  hub: "disconnected", lastHubLocationAt: null, lastSeqChangeAt: null, schemaMismatch: false,
  preview: null,
  diag: { online: true, lastPollOkAt: null, consecutivePollFailures: 0,
          snapshotFetchFailing: false, firstLoadStartedAt: 0 },
};
```

```ts
// src/store/store.ts
export type Listener = () => void;
export function createStore(initial: SiteStore) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState(patch: Partial<SiteStore> | ((s: SiteStore) => SiteStore)) {
      state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
      listeners.forEach(l => l());
    },
    subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  };
}
export const store = createStore(initialStore);
```

React reads through `useStore(selector)` built on `useSyncExternalStore` with referential selectors, so a new live object re-renders only the components that read the fields that changed. The map module subscribes to the store directly and moves the marker imperatively; React never re-renders the map on a fix.

### 5.2 State machine

The page at `/` is a pure function of the store. States and the events that move between them:

```
                 startDataLoop()
                        |
                        v
                  [ loading ]  <----------------------------- (retry 1 s, 2 s, 3 s, then 5 s forever)
                        |  first live object applied
                        v
        +---------------------- role page for live.eventStatusId ----------------------+
        |          |            |          |          |            |              |
   [ no_event ] [ planned ] [ scheduled ] [ live ]  [ ended ]  [ cancelled ]  [ postponed ]
      null         1            2          3          4            5              6
        ^          ^            ^          ^          ^            ^              ^
        +--------------- every applied live object re-evaluates the switch -------------+

   a known status whose role page is not in the published document ---> [ planned ]

   any state --- an object with schemaVersion !== 1 ---> [ reload ]   (terminal until location.reload())
```

Orthogonal indicator states, rendered as banners or chips, never as pages:

| Indicator | Condition | Where |
|---|---|---|
| `hubEnabled` | `live.hubEnabled === false` (1.2): the hub is never started and a started one is stopped (`syncHubWithStore` in `store/hub.ts` follows the flag on every applied live object); the transport then reads `polling`. The operator's switch for every visitor at once | Data loop |
| `transport` | `live` while `hub === "connected"`; `polling` while it is not and a poll succeeded within `2 * pollIntervalMs`; `offline` otherwise. Transport only: the beacon's cadence never moves it (the quiet rule of 5.5 drives the poll cadence, not this label) | Live indicator on the live screen |
| `updatesPaused` | `!diag.online` or `diag.consecutivePollFailures >= 3` | Banner in the shell on every page |
| `waitingForFix` | live screen and `live.seq === null` | Marker state and chip |
| `signalLost` | live screen, `live.seq !== null`, `performance.now() - lastSeqChangeAt > 30000` | Marker state and chip |
| `timeReady` | `(snapshot?.event?.statusId ?? null) === live.eventStatusId` | Countdown, liftoff timer, end time render blank when false |
| `snapshotStale` | `diag.snapshotFetchFailing` | Small "refreshing details" note under the latest message |

One page per status, all admin-composed. The site holds no screen components: it holds section kinds and renders the page the document names for the role.

### 5.3 Apply rule

`applyLive` is pure and is the only way a live object enters the store.

```ts
// src/store/applyLive.ts
export function shouldReplace(cur: LiveObject | null, L: LiveObject): boolean {
  if (cur === null) return true;
  if (L.eventId !== cur.eventId) return L.publishedAt > cur.publishedAt;   // ordinal string compare
  if (cur.seq !== null && L.seq === null) return false;
  if (cur.seq !== null && L.seq !== null && L.seq < cur.seq) return false;
  if (L.seq === cur.seq && L.publishedAt <= cur.publishedAt) return false;  // covers both-null seq
  return true;
}

export type ApplyResult = { state: SiteStore; applied: boolean; snapshotUrlChanged: boolean };

export function applyLive(state: SiteStore, L: unknown, now: number): ApplyResult {
  if (!isRecord(L) || L.schemaVersion !== 1) {
    return { state: { ...state, schemaMismatch: true }, applied: false, snapshotUrlChanged: false };
  }
  const live = L as LiveObject;
  if (!shouldReplace(state.live, live)) return { state, applied: false, snapshotUrlChanged: false };
  const seqChanged = state.live === null || state.live.seq !== live.seq;
  return {
    state: { ...state, live, lastSeqChangeAt: seqChanged ? now : state.lastSeqChangeAt },
    applied: true,
    snapshotUrlChanged: live.snapshotUrl !== state.snapshotUrl,
  };
}
```

`publishedAt` comparisons are plain `<`, `>`, `<=` on the strings; the canonical fixed-width format makes that time order. Unknown fields on any object are ignored. The site derives nothing from the object except the screen choice.

### 5.4 Page selection

```ts
// src/content/selectPage.ts
import type { ContentBundle, ContentPage, PageRole } from "../contracts";

export type Surface = "loading" | "reload" | { page: ContentPage } | "notFound";
const ROLE_BY_STATUS: Record<number, PageRole> = { 1: "planned", 2: "scheduled", 3: "live", 4: "ended", 5: "cancelled", 6: "postponed" };

export function selectBundle(s: SiteStore): ContentBundle | null {
  if (s.preview) return s.preview;
  if (!s.snapshot) return null;
  // Memoized on the snapshot identity: the store object changes on every live
  // poll while the snapshot does not, and a fresh bundle each poll rebuilds
  // everything keyed on it.
  return { content: s.snapshot.content, media: s.snapshot.media, icons: s.snapshot.icons };
}

export function selectRole(s: SiteStore): PageRole | null {
  if (s.live === null) return null;
  if (s.live.eventStatusId === null) return "no_event";
  return ROLE_BY_STATUS[s.live.eventStatusId] ?? null;              // unknown status id: null, treated like reload
}

export function selectHome(s: SiteStore): Surface {
  if (s.schemaMismatch) return "reload";
  const role = selectRole(s); const bundle = selectBundle(s);
  if (s.live === null || bundle === null) return "loading";
  if (role === null) return "reload";
  const page = bundle.content.pages.find(p => p.role === role)
    ?? bundle.content.pages.find(p => p.role === "planned");        // role page not published yet: the planned page
  return page ? { page } : "reload";
}

export function selectSlug(s: SiteStore, slug: string): Surface {
  if (s.schemaMismatch) return "reload";
  const bundle = selectBundle(s);
  if (bundle === null) return "loading";
  const page = bundle.content.pages.find(p => p.slug === slug);
  if (!page) return "notFound";
  return page.role === "none" ? { page } : "redirectHome" as never;   // role pages live at /
}
```

```ts
// src/store/liveState.ts
export type LiveState = "waitingForFix" | "tracking" | "signalLost";
export function selectLiveState(s: SiteStore, now: number): LiveState {
  if (s.live?.seq === null) return "waitingForFix";
  return s.lastSeqChangeAt !== null && now - s.lastSeqChangeAt > 30000 ? "signalLost" : "tracking";
}
export function selectTimeReady(s: SiteStore): boolean {
  return (s.snapshot?.event?.statusId ?? null) === (s.live?.eventStatusId ?? null);
}
```

Status 6 (`postponed`) has its own role page. A deployment whose editor has not yet published that page (contracts: the migration adds it unpublished) serves a document without it; `selectHome` then renders the `planned` page, the same fallback for any known status whose role page the document lacks. Only an unknown status id (`selectRole` returns null) renders the reload prompt. Nothing status-gated follows the postponed status: the countdown renders on status 2 only and the airborne time on status 3 only.

The switch happens the moment the live object is applied: `selectRole` changes, and `HomePage` renders the role page from the snapshot it already holds. The snapshot named by the new `snapshotUrl` arrives a moment later and, if the pages changed since the last publish, the page re-renders; the event fields (name, times, message) fill in then, and until then the time-shaped sections render blank per `selectTimeReady`.


### 5.5 Poll cadence

```ts
// src/store/cadence.ts
export function isHubQuiet(s: SiteStore, now: number): boolean {
  const live = s.live;
  if (live === null || live.eventStatusId !== 3) return false;        // outside status 3 the hub is never quiet
  return s.hub !== "connected"
    || s.lastHubLocationAt === null
    || now - s.lastHubLocationAt > 2 * live.pollIntervalMs;
}

// isHubQuiet drives the poll cadence only; the live indicator reads the
// transport (5.2), never this, so a beacon that fixes slower than the poll
// window does not flip the label.
export function pollCadenceMs(s: SiteStore, now: number): number {
  const base = s.live?.pollIntervalMs ?? 5000;
  return isHubQuiet(s, now) ? Math.max(1000, base / 2) : base;
}
```

---

## 6. The data loop

`startDataLoop()` runs once from `main.tsx` and is idempotent. Nothing else on the site fetches anything.

### 6.1 Startup

1. `diag.firstLoadStartedAt = performance.now()`. `GET LIVE_URL`. On failure (network error, non-2xx, unparsable JSON) retry after 1 s, 2 s, 3 s, then every 5 s forever. The loading screen renders until the first success.
2. Apply the object (5.3). When `snapshotUrlChanged`, fetch the snapshot (6.5); the snapshot carries the flight history, so nothing else is fetched.
3. Dynamically import the hub module and start the connection (6.3). Arm the poll timer (6.4). Register the `visibilitychange`, `online`, and `offline` listeners (6.6).

### 6.2 CDN fetches

```ts
// src/store/fetchers.ts
async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { credentials: "omit", signal: ctl.signal });   // default cache mode, no headers
    if (!res.ok) throw new CdnError(res.status, url);
    return (await res.json()) as T;
  } finally { clearTimeout(t); }
}
export const fetchLive = () => fetchJson<unknown>(LIVE_URL);
export const fetchSnapshot = (url: string) => fetchJson<unknown>(url);
```

Rules: default cache mode (the browser revalidates `live/location.json` because of `max-age=0`, and a `304` is a success), `credentials: "omit"`, no custom headers, no query strings ever appended, only absolute URLs read from objects. Every fetched object is checked for `schemaVersion === 1` before it is stored; any other value sets `schemaMismatch` and the object is dropped.

### 6.3 Hub

```ts
// src/store/hub.ts (loaded with import("@microsoft/signalr") from loop.ts)
const connection = new signalR.HubConnectionBuilder()
  .withUrl(env.HUB_URL, { skipNegotiation: true, transport: signalR.HttpTransportType.WebSockets })
  .withAutomaticReconnect([1000, 2000, 3000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000])
  .configureLogging(signalR.LogLevel.Warning)
  .build();
connection.keepAliveIntervalInMilliseconds = 15000;
connection.serverTimeoutInMilliseconds = 30000;
```

Lifecycle, in this order:

1. Register handlers before `start()`:
   - `connection.on("ChannelEvent", envelope => ...)`: route on `envelope.channel === LOCATION_CHANNEL` and `envelope.event`. `location`: `applyLive(envelope.data)` and set `lastHubLocationAt = performance.now()`. `joined`: set `hub = "connected"`. `channelEvicted`: step 6. Every other envelope is ignored.
   - `connection.onreconnecting(() => hub = "reconnecting")`.
   - `connection.onreconnected(async () => { await join(); pollNow(); })`.
   - `connection.onclose(() => { hub = "disconnected"; startLoop(); })`.
2. `startLoop()`: `hub = "connecting"`; `await connection.start()`; on rejection wait 1 s, 2 s, 3 s, then 5 s forever and try again; the backoff resets on success. `start()` resolving leaves `hub` at `"connecting"`.
3. `join()`: `await connection.invoke("JoinChannel", LOCATION_CHANNEL)`. The `joined` ack, not the invoke resolving, sets `"connected"`.
4. A rejected join: if the error text matches `/throttl|budget|rate/i` retry with the 1 s, 2 s, 3 s, 5 s backoff; otherwise (denied or unknown) wait 10 s before the first retry, then the same backoff. Polling continues regardless; a join that never succeeds means the site runs on the CDN at the quiet cadence while live.
5. After a successful re-join (reconnect or eviction) the loop calls `pollNow()` so anything published during the gap is fetched from the CDN.
6. `channelEvicted` with `data.reason === "auth_expired"`: `join()` again immediately, then `pollNow()`. This happens roughly every 15 minutes for every connection and is routine. `data.reason === "service_removed"`: keep the connection and retry `join()` every 5 s.
7. Exactly one connection exists per tab; `hub.ts` guards against a second `startHub()`.

The hub is started in every status. Outside status 3 it carries the status change itself; inside status 3 it is the fast path for fixes.

### 6.4 Poll timer

```ts
// src/store/loop.ts (excerpt)
let timer: number | null = null;
let inFlight = false;

async function tick() {
  timer = null;
  if (document.hidden || inFlight) return;
  inFlight = true;
  try {
    const obj = await fetchLive();
    store.setState(s => applyAndFetchDependents(s, obj));
    store.setState(s => ({ ...s, diag: { ...s.diag, lastPollOkAt: performance.now(), consecutivePollFailures: 0 } }));
  } catch {
    store.setState(s => ({ ...s, diag: { ...s.diag, consecutivePollFailures: s.diag.consecutivePollFailures + 1 } }));
  } finally {
    inFlight = false;
    arm();
  }
}

function arm() {
  if (timer !== null || document.hidden) return;
  timer = window.setTimeout(tick, pollCadenceMs(store.getState(), performance.now()));
}

export function pollNow() { if (timer !== null) { clearTimeout(timer); timer = null; } void tick(); }
```

- The timer is re-armed after each fetch completes, never on a fixed interval, so fetches never overlap and a changed `pollIntervalMs` on the applied object takes effect on the next arm.
- A `403`, `404`, `5xx`, timeout, or network failure keeps the current store and waits for the next tick.
- Cadence is `pollIntervalMs` when not quiet and `max(1000, pollIntervalMs / 2)` when quiet; quiet is defined only while `eventStatusId === 3` (5.5).

### 6.5 URL change handling

After every applied live object:

```
wantedSnapshotUrl = live.snapshotUrl
if wantedSnapshotUrl !== store.snapshotUrl and no fetch for wantedSnapshotUrl is in flight:
  fetch it with the 1, 2, 3, 5 s backoff on failure (diag.snapshotFetchFailing = true while retrying)
  on success, and only if wantedSnapshotUrl still equals store.getState().live.snapshotUrl:
    schemaVersion check; store.snapshot = S; store.snapshotUrl = wantedSnapshotUrl; snapshotFetchFailing = false
  a result for a URL that is no longer wanted is discarded
```

The old snapshot keeps rendering while a replacement is in flight. A changed `snapshotUrl` is the only way a new sponsor, message, funds percent, cookie type, or route map reaches the browser.

### 6.6 Visibility and lifecycle

| Event | Action |
|---|---|
| `document.hidden` becomes true | Clear the poll timer. Keep the hub connection. Pause the sponsor carousel timer and the 1 s UI clock. |
| `document.hidden` becomes false | `pollNow()`, re-arm, resume timers, re-acquire the wake lock on the live screen. |
| `offline` | `diag.online = false` (banner). Polling continues; failures are cheap. |
| `online` | `diag.online = true`; `pollNow()`. |
| `pagehide` | Nothing; the browser tears the socket down. |

A 1 s UI clock (`useNow()`) drives the countdown, liftoff timer, "updated N s ago", and the signal-lost evaluation; it does not touch the store.

---

## 7. Pages and sections

All time formatting uses the device clock; times arrive as UTC and are shown in the viewer's browser timezone with the zone abbreviation from `Intl.DateTimeFormat`. Every string a visitor reads comes from the content document, rendered through the inline grammar (7.5); the site's own copy is limited to `copy/copy.ts`.

### 7.1 Loading and reload

`Loading` shows until the first live object and the first snapshot are both held. Copy from `copy.ts`; after 15 s without success a second line says the site is still trying. `ReloadPrompt` covers the app when `schemaMismatch` is set (section 19).

### 7.2 Page renderer

```tsx
// src/content/PageRenderer.tsx
export function PageRenderer({ page, bundle }: { page: ContentPage; bundle: ContentBundle }) {
  return (
    <main id="main">
      {page.sections.map(s => {
        const Kind = registry.sections[s.kind] ?? Unknown;
        return (
          <SectionFrame key={s.id} presentation={s.presentation} bundle={bundle} anchor={s.presentation.anchor}>
            <Kind data={s.data} items={s.items} bundle={bundle} />
          </SectionFrame>
        );
      })}
    </main>
  );
}
```

`SectionFrame` turns `presentation` into layout: `width` picks the max-width token (`full` is edge to edge, `wide` 1200 px, `narrow` 720 px), `align` sets text alignment, `spacing` the vertical padding token, `background` either nothing, a theme token class (`surface`, `muted`, `accent`, `night`), or a media image with a dark overlay at the given opacity, `iconBefore` and `iconAfter` render as decorative icons (`aria-hidden`) above and below the content, and `anchor` becomes the section's `id`. A `map` section is the exception: it ignores width and spacing and takes the viewport (7.6); while the event is live the live page renders that section alone.

**Card by default.** Every section renders inside a card so the page reads as a stack of panels, unless its `presentation.card` is `false` (absent or `null` means carded). The one exception is `map`: it never has a card, even with `card: true`. The card is built only from tokens: `background: var(--panel)`, `1px solid var(--line)` border, `var(--radius-md)` corners, `var(--shadow)`, and `var(--space-5)` padding on desktop reducing to `var(--space-4)` below 640 px. Every card has one fixed maximum width, `var(--width-wide)`, and is centred inside the frame whatever the section's `presentation.width`; below that width the card fills the frame. The card's content fills the card minus its padding. `presentation.width` does not change a card's width; a section with `card: false` (and `map`) renders on the page background and honours it. `presentation.align` still aligns text inside the card. A carded hero keeps its min-heights inside the card. A `hero` immediately followed by a `countdown` (the `heroCountdownPair` layout) renders as one card holding both, under the same card rule; when the hero's `card` is `false` the pair stays open on the page background. Consecutive card frames are separated by `var(--space-4)`; the outer page gutter is unchanged. A `background.kind = "token"` (surface, muted, accent, night) becomes the card fill instead of the panel and keeps its text colour; a `background.kind = "media"` renders inside the card so the image clips to the rounded corners under the overlay. The frame exposes the decision on the section element as `data-card="true"` or `data-card="false"` for tests and styles to read. One card per section, never nested: the section components no longer paint their own outer chrome where the frame supplies it (the `card` style of `latest_message`, `event_times`, `funds_ring`, the full `leaderboard`, `cookie_control`'s closed and signed-out panels, the `card` variant of `sponsor_carousel`), while inner item cards (`links` in the `cards` style, `sponsor_grid`'s sponsor cards, the leaderboard rows) stay because those are items, not the section.

**Card fill opacity.** The card's fill can be translucent so the background ornaments show through while scrolling. For each theme the frame resolves the value in this order: the section's `presentation.cardOpacityLight` or `cardOpacityDark`, else the sitewide `settings.theme.cardOpacityLight` or `cardOpacityDark`, else 100 (absent or `null` falls through). Light and dark resolve independently. The frame publishes the resolved pair on the card element as the custom properties `--card-opacity-light` and `--card-opacity-dark` (percentages) and emits nothing when both resolve to 100. `SectionFrame.module.css` picks the one for the theme in use, scoped the way `tokens.css` scopes the themes (`:root[data-theme="dark"]` and otherwise light), so flipping the appearance switches the value live with no script. The rule is fill only: the card's background becomes `color-mix(in srgb, <fill> <alpha>, transparent)` where the fill is `var(--panel)` or the `token` background's colour. The border, the shadow, the radius, the padding, and every child (text, icons, images, controls) stay fully opaque; the card element never takes CSS `opacity`. A `media` background is the fill and is unaffected. The `heroCountdownPair` card takes the hero's values. A section with `card: false` (and `map`) has no card, so its values have no effect.

The registry:

```ts
// src/content/registry.ts
export const registry = {
  sections: { rich_text: RichText, hero: Hero, media: MediaGallery, links: Links, icon_row: IconRow, divider: Divider,
              funds_ring: FundsRing, countdown: Countdown, event_times: EventTimes, latest_message: LatestMessage, map: Map,
              leaderboard: Leaderboard, sponsor_carousel: SponsorCarousel, sponsor_grid: SponsorGrid, route_preview: RoutePreview,
              cookie_control: CookieControl, alerts_signup: AlertsSignup, contact_form: ContactForm } as Record<string, SectionComponent>,
  blocks: { heading: HeadingBlock, paragraph: ParagraphBlock, list: ListBlock, quote: QuoteBlock, media: MediaBlock,
            links: LinksBlock, icon: IconBlock, divider: DividerBlock } as Record<string, BlockComponent>,
};
```

A test asserts that every kind in the vendored `contracts/kinds.json` has an entry and that each renders its `defaults` without throwing. `Unknown` renders nothing and logs the kind once.

A section whose component renders nothing collapses its frame: no card, no padding, no background, no icons before or after, and the section element takes no space in the flow.

### 7.3 Primitives

| Primitive | Component | Rendering |
|---|---|---|
| `Icon` | `primitives/Icon.tsx` | `source: "library"`: `<img src={bundle.icons[id]}>`; `source: "media"`: `<img src={bundle.media[id].url}>`. Always `<img>`, never inline SVG. Decorative uses pass `alt=""` and `aria-hidden`; an icon standing for something (a link icon without a label) gets the label as `alt`. Unresolvable id: renders nothing, logs once. |
| `MediaRef` | `primitives/Media.tsx` | `<img src={entry.url} srcset={...} sizes={...} width height alt loading="lazy" decoding="async">`; `srcset` lists every `variants[w]` as `{url} {w}w` plus the original as `{url} {width}w`; `sizes` from the frame width (`full`: `100vw`; `wide`: `(min-width: 1200px) 1200px, 100vw`; `narrow`: `(min-width: 720px) 720px, 100vw`), or the block's size for a media block; `alt` is `ref.alt ?? entry.alt`. `svg` and `gif` render with `src` only. Missing id: an empty box with the alt text, logged once. |
| Logo | `content/Logo.tsx` | The site settings `logoMedia` through `Media` (so the media entry's resolution, variants, and dark mode handling apply) inside a box of a given height: the image fills the height with `width: auto` and `object-fit: contain`, no badge, no crop, loaded eagerly. `alt` is `logoMedia.alt`, else the asset's alt, else `settings.siteName` (an empty string counts as unset). Renders nothing when `logoMedia` is absent or `null`. Used by the header (7.7) and by the hero with `showLogo` (7.4). |
| `Link` | `primitives/LinkView.tsx` | Site paths render as router links; absolute URLs and `mailto:` as `<a>` with `rel="noopener noreferrer"` and `target="_blank"` when `newTab`; the icon before the label. |
| `Inline` | `inline/Inline.tsx` | Section 7.5. |

**Component recipes.** Every button, icon button, pill, chip, and badge on the site renders from the recipes in `src/ui/`, and every caller composes them (`composes:`) instead of copying: `Button.module.css` (`.btn`, the secondary: the accent on `--accent-soft`, weight 500, 40 px tall at the least, `0.4rem 1rem`; `.btnFill`, the primary: `--on-accent` on `--accent`, weight 600; `.btnQuiet`: `--text` on `--panel-2`; `.btnSm`, 34 px), `IconButton.module.css` (`.ibtn`, a 44 px circle on `--panel-2`, `aria-pressed="true"` in the accent on `--accent-soft`), `Pill.module.css` (`.pill`, `var(--font-sans)` 0.75rem weight 600 in sentence case with no letter spacing, `3px 10px`, on `color-mix(in srgb, currentColor 14%, transparent)`, with the tone classes `pillOk`, `pillWarn`, `pillErr`, `pillDim`, `pillAccent`, and `pillText` setting the colour; `StatusPill` keeps its dot), and `Field.module.css` for inputs. The look is Frost: fills without borders (only the tracker's `.glass` surface keeps its line border, since it sits on a map). Two radii: `--radius-control` (999 px) for every button, icon button, pill, chip, glass pill, and input, and `--radius-md` (16 px) for cards, dialogs, menus, and popovers; `--radius-sm` (6 px) is left for tiles and thumbnails. Hover is a tint: a filled button takes `filter: brightness(0.94)` in light and `brightness(1.12)` in dark, and the secondary, quiet, and icon buttons take `--accent-soft` with `--accent` text; a disabled control is at half opacity with no hover change, and focus is the global outline. The alerts bell's count badge stays a solid `--err` circle. The token contrast test holds the accent on `--accent-soft` over the panel, `--on-accent` on `--accent`, `--text` on `--panel-2`, and every pill tone on its 14 percent tint over the panel to 4.5:1 in both themes, and a build test fails when a CSS module outside `src/ui/` declares a 40 px button of its own.

`presentation.iconSize` sizes both `iconBefore` and `iconAfter`: `sm` 24 px, `md` 48 px, `lg` 72 px, `xl` 96 px; absent or `null` is `sm`. The values live in `SECTION_ICON_SIZES` in `src/content/iconSizes.ts`.

`primitives/resolve.ts` holds `resolveMedia(bundle, id)` and `resolveIcon(bundle, icon)`; nothing else touches the maps.

A media-sourced icon whose entry is raster loads its smallest variant (the `480` key when present) and falls back to `url`; svg and gif entries keep `url`.

Dark mode for a media entry is CSS only, so nothing flashes on load (the head script stamps `data-theme` before first paint) and no script picks an image. An entry whose `dark` is set renders two images with the same alt: the light one carries a class hidden under `:root[data-theme="dark"]` and the dark one (`dark.url`, its own `srcset` from `dark.variants`) a class hidden otherwise; `display: none` keeps the hidden one out of the accessibility tree. An entry with `invertInDark` true and no `dark` renders one image with a class that applies `filter: invert(1) hue-rotate(180deg)` under `:root[data-theme="dark"]`. With neither set, and always in light mode, one plain image. The rules live in `primitives/DarkMedia.module.css` and apply wherever `Media` or a media-sourced `Icon` draws an entry: section icons, the Logo, a media background, sponsor logos, galleries, and media blocks (a media-sourced icon takes the dark version's `480` variant when raster). Library icons and the deep-zoom poster viewer are not affected.

Small screens for a media entry are CSS only too, on the site's 760 px cut. An entry whose `small` is set (contracts 1.3b Small screens: `small.url`, `small.variants`, `small.dark`, `small.invertInDark`) renders two branches with the same alt: the entry itself, carrying a class hidden under `@media (max-width: 759.98px)`, and the small version, carrying a class hidden under `@media (min-width: 760px)`, so the small version draws in the asset's place under 760 px and the entry at 760 px and up, with no script involved and nothing flashing at either boundary. Each branch composes with dark mode on its own: the entry's branch uses the top-level `dark` and `invertInDark` as above, and the small branch uses `small.dark` (its own `srcset` from `small.dark.variants`) and `small.invertInDark` by the same rules; the small image's `srcset` comes from `small.variants`. Each image carries `data-screen` (`wide` or `small`) beside `data-dark-mode`. The rules live in `primitives/DarkMedia.module.css` beside the dark mode ones and apply wherever `Media` draws: media sections, galleries, rich text media blocks, section background images, the `route_preview` image, and the Logo. An entry without `small` renders as it does without this rule. Icons (library and media-sourced) and sponsor logos (`Media` with `small={false}`) always draw the entry itself.

A media entry's `credit` (contracts 43, a string or `null`) renders where the entry is a visible picture: every figure of a `media` section and every rich text `media` block. `primitives/MediaCredit.tsx` draws a non-null, non-blank credit as one `<p data-testid="media-credit">` directly under the image and above any caption, small (0.75rem) and muted with `--text-dim` so it reads in both themes, wrapping when long (`overflow-wrap: anywhere`); a media block's line follows the section's align and is capped at the block's size. The line belongs to the entry, not to an image branch, so the dark mode and small screen versions draw above the same single line. A `null` or absent credit renders nothing. Section background images, icons (library and media-sourced), the Logo, the `route_preview` image, and sponsor logos never render a credit.

An icon (either source) or a `MediaRef` with `display` set renders inside a wrapper built by `displayStyle` in `primitives/display.ts`; every key is optional and a value outside the contract is ignored. `sizePx` (12 to 600) sets the box: an icon's width and height, a media's width with height auto, or with `fit: cover` a square of that size; it beats every preset size (the hero `iconSize`, the `icon_row` size, the `icon` and `media` block sizes, and `presentation.iconSize`). `fit` (`contain`, `cover`) sets the image's `object-fit`. `shape` sets the wrapper's radius: `circle` 50 percent, `rounded` `var(--radius-md)`, `square` 0, and `none` keeps the usual look. `paddingPx` (0 to 48) pads the wrapper. `background` fills it with the same tokens as the section backgrounds (`surface` `--panel`, `muted` `--panel-2`, `accent` `--accent`, `night` `--ground`; `none` fills nothing). `shadow` true adds `var(--shadow)`. `align` (`start`, `center`, `end`) places the wrapper in its line. With no `display` (absent or `null`) the icon or media renders exactly as it does without the key.

### 7.4 Section kinds

Content kinds read `data`, `items`, and the bundle only. Live kinds read the store through selectors, exactly as contracts 1.3a lists.

| Kind | Reads | Behaviour |
|---|---|---|
| `rich_text` | `data.blocks` | Renders each block through `registry.blocks` (7.5); an unknown block kind renders nothing. The blocks sit in one column capped at 68ch that follows the section's `presentation.align`: `center` centres the column in its card or content box (and the frame centres its lines), `start` keeps it at the start |
| `hero` | `data` | Title as `<h1>` (the first hero on a page) or `<h2>`, tagline, icon above the title, up to two links as buttons; `height` picks a min-height token; `iconSize` sizes the icon at `sm` 56 px, `md` 96 px, `lg` 144 px, `xl` 200 px (absent or `null` is `sm`; the values live in `HERO_ICON_SIZES` in `src/content/iconSizes.ts`): a library icon sits in a round badge of that size with the glyph at 60 percent, a media icon (any uploaded image) renders at that size with no badge and no circle crop (`object-fit: contain`); `showLogo: true` with the site settings `logoMedia` set draws the Logo (7.3) in place of the icon, its height taken from the same table (`sm` 56, `md` 96, `lg` 144, `xl` 200 px by `iconSize`) and its width following the image, and with no `logoMedia` the hero draws its icon as usual (absent or `null` `showLogo` is false); the background image, when the frame's `presentation.background` is media, is the frame's cover image with its overlay. The hero follows the section's `presentation.align` at every width: `start` puts the icon or logo, the copy, and the links at the start, `center` centres them; existing heroes aligned `start` (the default) render start-aligned on desktop too, and the admin sets Centre for a centred hero. The paired hero (`heroCountdownPair`, 7.2) stays start-aligned whatever the align |
| `media` | `data.layout`, `items` | `single`: one image with caption; `grid`: CSS grid with `data.columns`; `carousel`: one at a time with previous and next buttons and swipe, no autoplay, crossfade unless reduced motion; an item with `link` wraps the image |
| `links` | `data.style`, `items` | Buttons, cards (label, icon, description), or a list |
| `icon_row` | `data`, `items` | Decorative row of icons with optional labels; icons `aria-hidden` when unlabelled |
| `divider` | `data.style` | A line, a row of snowflake icons, or a string of lights (CSS) |
| `funds_ring` | `snapshot.event.fundsPercent`, `year` | SVG ring filled to the percent with the number in the middle (always centred in the ring), animated fill unless reduced motion; one column at every width with the heading, caption, and Donate button under the ring; `presentation.align` puts the whole stack at the start or the centre (centre also centres the text); `showYear` adds the year to the heading; 0 and no year when `event` is null |
| `countdown` | `snapshot.event.scheduledAt`, `live.eventStatusId` | `Xd Xh Xm Xs` from the 1 s clock; renders nothing unless status is 2 and `now < scheduledAt`; blank while `!timeReady` |
| `event_times` | `snapshot.event.scheduledAt`, `wentLiveAt`, `endedAt`, `live.eventStatusId` | One labelled line per field in `data.fields` whose value exists, formatted in the viewer's timezone; `airborneFor` is `formatElapsed(now - wentLiveAt)` on the 1 s clock while status is 3; blank while `!timeReady` |
| `latest_message` | `snapshot.event.latestMessage` | `card`: body plus `createdAt`; `ticker`: one collapsible line; `aria-live="polite"`; nothing when null. Rendering a message with a numeric id marks it read (`markMessageSeen(event.id, message.id)`, 7.6) in an effect keyed on the two ids, in both styles and with the ticker collapsed, so the tracker's envelope pill shows it as read |
| `map` | the live object, `snapshot.event.flightHistory`, and everything section 8 lists | The live screen (7.6) |
| `leaderboard` | `live.cookieTally`, `snapshot.cookieTypes` | Section 9 |
| `sponsor_carousel` | `snapshot.sponsors`, `bundle.media` | Section 15; logo through `Media` with `sizes` fixed at `data.logoWidth` |
| `sponsor_grid` | `snapshot.sponsors`, `bundle.media` | Every sponsor in snapshot order (pinned first, then largest gift first; the site never re-sorts) as equal cards in one responsive grid: `repeat(auto-fill, minmax(280px, 1fr))` with a 16 px gap, which gives three columns from 1024 px, two down to about 640 px, and one below; every card the same height in its row (`align-items: stretch`, the grid's implicit rows). A card is the sponsor's name as its heading at the top, the logo large and centred in a fixed 3:2 box (the 480 variant through `Media`, `object-fit: contain`, the name as large text when `logoMediaId` is null), then a bottom row with "Sponsor for N years" at the left when `showYears` and the link icons at the right (globe for `websiteUrl`, Facebook for `fbUrl`, Instagram for `igUrl`, each an `<a>` with its `aria-label` and `rel="noopener"`, only when non-null). The whole card is a link to `websiteUrl ?? fbUrl ?? igUrl` (new tab) when any is set, with the icons as separate links above it in the tab order; otherwise a plain card. The frost card recipe of 7.7, no tiers, no amounts, nothing that hints at a gift's size; `emptyText` when none |
| `route_preview` | `snapshot.event.routeMap`, `snapshot.event.routeMapConfig`, `content.settings.landmarks` | The heading, `data.disclaimer` above the map when set, and the route map of 8.9: `event.routeMap.path` (contracts 1.3) drawn by the map host in route mode over the event's map (`snapshot.event.trackerMap`, MapLibre) or over Google Maps when the renderer choice of 8.1 lands there, in a frame `--route-preview-max-h` (`min(70vh, 720px)`) tall at the section's width, with a fullscreen button and a terrain toggle on the map unless the event's `routeMapConfig.controls.fullscreen` or `routeMapConfig.controls.terrain` is false (absent or null means true). When `event.routeMap` is null (or its path has fewer than two points), or the map fails after the fallbacks of 8.9, it renders the heading and `emptyText`, never a picture, and nothing when `emptyText` is empty. The section data is the heading, the disclaimer, and `emptyText`; a `style` key in an older published document is ignored |
| `cookie_control` | auth, `live.eventStatusId`, `snapshot.cookieTypes` | Section 10; `closedCopy` outside status 3; `signedOutCopy` with a sign-in link when signed out |
| `alerts_signup` | auth, `GET /me`, `GET /me/subscriptions` | Section 13; `signedOutCopy` with a sign-in link (`returnTo` the current path) when signed out |
| `contact_form` | `settings.contactEmail` | Section 14 |

Headings: every kind with a `heading` renders it as `<h2>` when non-null. Copy fields (`copy`, `caption`, `emptyText`, and the rest) are `Inline`.

### 7.5 Blocks and inline text

Blocks render through `registry.blocks` inside `rich_text`: `heading` (`<h1>` to `<h3>` by `level`, icon before the text), `paragraph`, `list` (bullet, numbered, or icon-marked with `data.icon` before each item), `quote` (`<blockquote>` with `<cite>`), `media` (`Media` at `small` 320 px, `medium` 640 px, or the frame width, with a `<figcaption>`), `links` (buttons or a list), `icon` (one icon at `sm` 24, `md` 48, `lg` 96, `xl` 160 px, aligned), `divider`.

Every block follows the section's `presentation.align` (the frame's `data-align` hook, styled in `RichText.module.css`). Under `center` the heading row and the links row justify to the centre (a links list centres its items), a media block centres its image and its caption, and a quote and a list centre as a box fitted to their content; a list's items keep their start alignment so bullets stay readable. Under `end` the column sits at the end with its lines set to the end, and every block mirrors the centre rule at the end. Under `start` every block sits at the start.

`inline/parse.ts` is the site's copy of the grammar in contracts 1.3a and mirrors the API's parser: it tokenizes `**`, `*`, backtick, `[label](href)`, `{icon:<id>}`, `{icon:media:<uuid>}`, `{event:name}`, `{event:year}`, `{event:scheduledAt}`, and newlines; everything else is text; unbalanced markers are text. `Inline.tsx` maps tokens to `<strong>`, `<em>`, `<code>`, `LinkView`, `Icon` (inline-sized, `aria-hidden`), `<br>`, and text nodes. Placeholders resolve through `inline/placeholders.ts` from `snapshot.event` (`name`, `String(year)`, `scheduledAt` formatted in the viewer's timezone; empty string when `event` is null or the field is null). There is no `dangerouslySetInnerHTML` anywhere in the site.

### 7.6 The live screen (`map` section)

Full-viewport map with overlays, each switched by `data.overlays` and each control by `data.controls`:

**Height.** Under the live takeover the section is fixed to the viewport (`100dvh`), in a preview session too. On an ordinary page (a `map` section outside the live takeover) it sits in the page flow at `height: min(80vh, 720px)` with a `min-height` of 480 px, and `MapView`'s root fills it through its CSS class (`position: absolute; inset: 0`) with no inline geometry, so the map, its overlays, and the tracker menu render inside that box.

**Map unavailable.** When the map cannot be shown (8.1) the map area, or the whole section when the error boundary caught the failure, renders the panel `MapUnavailable` (`data-testid="map-unavailable"`, `role="alert"`) over `--panel`, centred: the title "Map unavailable" (`copy.map.unavailable`), under it the reason in one line (`.unavailableReason`, `data-testid="map-unavailable-reason"`: the mono font at 0.8125rem in `--text-dim`, `max-width: 32rem`, `overflow-wrap: anywhere`), and one button, "Reload the page" (`copy.map.retry`), which reloads the page.

| Component | Reads | Behaviour |
|---|---|---|
| `MapView` + `mapController` (`Map.tsx`) | `live.lat`, `live.lng`, `snapshot.event.flightHistory`, `content.settings.landmarks`, `content.settings.places`, theme, map type, `data.defaultCenter`, `data.defaultZoom`, `data.flightHistoryDefault`, `snapshot.event.trackerBbox`, `snapshot.event.trackerMap`, `snapshot.trackerThemes` | Section 8. The map is the MapLibre host in live mode (8.10) when the renderer choice of 8.1 is `maplibre` and the Google controller otherwise; both sit behind the controller interface of 8.3, so nothing in this table knows the renderer, and both are locked to the event's box (8.2). The map shows one marker at Santa's current position and nothing about where he has been. The tracker's places come from the site settings' `settings.places.tracker` (contracts 57), never from the section's data: while it is absent the map style keeps its own places and the section hands the controller `setPois(null)`; while it is present the map shows only the kinds in its `kinds` (unknown kinds dropped, repeats removed, an empty list meaning none) and the section hands the controller `setPois({ kinds })`. The section resolves the settings' `places` through the route map's `resolvePlaces` (8.9) once per change. The tracker menu has no control for this; it is the editor's choice |
| `santaMarker` | `live.lat/lng`, `selectLiveState` | Position on each applied object; `waitingForFix` shows no marker at the default view; `signalLost` desaturates and dims the same image and the marker stays put. The marker is the legacy red pin with the Santa hat, the bundled `src/map/santa-pin.png` (8.7) |
| `LiveIndicator` | `hub`, `lastPollOkAt`, `live.pollIntervalMs`, `live.publishedAt`, `live.onlineCount`, `data.overlays.onlineCount` | A pill: the dot and label by `transport` (5.2): "Live" in `--ok`, "Polling" in `--warn`, "Offline" in `--err`. While `transport` is `live` and `live.onlineCount` is a finite number, the label is followed by the count of connected viewers: a 14 px eye glyph in the accent and the count through `formatCount` ("1.2k", "12.3k"), `data-testid="watching-count"`, updated in place as live objects arrive; the word "watching" is not on screen but follows the count in a visually hidden span for screen readers. Polling, offline, a null count, or `overlays.onlineCount` false (on by default; Map passes it as `showCount`) leave neither eye nor count. Then "Updated N s ago" from `publishedAt` on the device clock only once the feed has gone quiet for the 30 s signal-lost threshold, in `--warn`; while fixes are flowing the pill is the label (and the count) alone, so a normal cadence never churns the text, so a stalled beacon shows here as well as on the marker |
| `FixStatus` | `selectLiveState`, `lastSeqChangeAt` | A pill under the live indicator and the airborne and distance pills, only while waiting for the first fix or after the signal is lost (in `--err`) |
| `AirbornePill` (`InfoOverlays.tsx`, `overlays.liftoffTimer`) | `snapshot.event.wentLiveAt`, `timeReady` | A pill directly under the live indicator (`data-testid="airborne-pill"`) holding `TakeoffGlyph` and the time since liftoff through `formatElapsed` ("1h 12m") on the `useNow(1000)` clock. It is not one of the gauge's instruments: the flight's own clock is a reading a visitor wants up the whole time, not one stop of a cycle. Absent entirely, rather than showing a placeholder, until `timeReady` and while `wentLiveAt` is null or unparseable, and absent with `overlays.liftoffTimer` off. The value carries a visually hidden "Airborne for" as its prefix and is not in a live region: it moves every second |
| `DistancePill` (`InfoOverlays.tsx`, `overlays.distanceChip`) | the user location state (8.6), `overlays.distanceChip` | A pill under the airborne pill, above the fix status (`data-testid="distance-pill"`), holding `PersonPinGlyph` and the visitor's distance from Santa through `formatDistanceMetres` ("3.11 mi", "840 ft"), present only while the flag is on, the visitor has their location enabled, and the distance is a finite number. The value carries a visually hidden "Distance to Santa" as its prefix and is not in a live region: it moves every second and would talk over everything else. The same distance stays in the dock's foot line and the tracker menu's data row |
| `FlightGauge` (`FlightGauge.tsx`, `gauges/`) | `live.speedMps`, `altitudeM`, `headingDeg`, `data.overlays.flightDock`, the `flightDock` toggle (8.5) | Three round dials stacked above the sponsor tile in the bottom-left stack, all three up at once, packed as tight as the circles allow (`data-testid="flight-gauge"`, a column with a 2 px gap). It replaced the instrument dock that spanned the bottom of the map, so nothing covers the map's bottom edge, neither bottom stack is lifted, and there is no collapsed state or handle pill: the gauge is either there or hidden. **Each face** is the glass recipe as a 78 px circle (74 px at 760 px and below) around its dial. **The dial** is `gauges/GaugeFrame.tsx` at 70 px (64 px below 760 px) on the 54 by 54 viewBox: the 270 degree track arc from 135 degrees in `--panel-2` (stroke 5, round caps), three 1 px marks in `--text-dim` at the arc's start, top and end, the value arc in `--accent` dashed to its fraction and swept over 300 ms through a transition on `stroke-dashoffset` (none under reduced motion), the value in the mono font at the centre, the unit under it at 6, and the label under the dial at 6 uppercase with 0.08em letter spacing in `--text-dim`. The label's size is what keeps it inside the circle: it sits near the bottom of the 54 unit box, where the face has narrowed to about half its width, so at 7 a long one like ALTITUDE poked out both sides. The value's size comes from `valueFontSize`, 16 down to 9 by the reading's length, so "58" is big and "312° NW" still clears the dial's walls. **The instruments** are three, each a slot from `gauges/` meeting the contract in `gauges/types.ts`: speed on a 0 to 120 mph dial, altitude on a 0 to 10,000 ft dial, and the heading compass, a compass face of its own with `track={false}` so it draws no track and no marks: the bezel circle, a long tick at each of north, east, south and west with a short one at the four points between, the letters N (in `--accent`), E, S and W around the inside at 4.5, and a two-ended needle that turns to the heading, an accent head reaching the bezel and a dim tail opposite, both stopping short of the middle (`NEEDLE_INNER`) so the reading sits in the clear centre. The compass reads the cardinal alone through `headingCardinalText` ("NW"), at a fixed 12 (`valueSize`) rather than the length-based size, so it clears the E and W letters either side; the degrees stay in the tracker menu's data row, which keeps `headingText` ("312° NW"). The needle turns through a CSS transform transition on the group, and its rotation is kept cumulative so each change takes the short way round; an unavailable heading draws the face with no needle and the placeholder. The airborne time and the distance are not among them: each has its own pill under the live pill, because both are readings a visitor wants up the whole time rather than one stop of a cycle. There is nothing to step with and nothing to remember: all three dials are up together. Flags: `overlays.flightDock` (a code-only key of the map section's data typing, the contract schema unchanged; absent means on) governs the whole gauge, so with it off there is no dial and no gauge button in the menu; `overlays.liftoffTimer` no longer reaches the gauge at all, it governs the airborne pill. A null reading shows `copy.live.unavailablePlaceholder` and no value arc, and airborne is blank until `timeReady`. The tracker menu's gauge button (the `flightDock` toggle) hides the whole thing, and it hides with the other overlays while the menu is open |
| `MessagesPill` and `MessagesDialog` (`overlays.latestMessage`) | `snapshot.event.latestMessage`, `snapshot.event.id`, the read mark in `src/lib/messageSeen.ts` | A 34 px pill in the pill recipe last in the top-left stack, under whatever else is in it (`data-testid="messages-pill"`), present while `overlays.latestMessage` is on and `snapshot.event.latestMessage` is not null and has a numeric id: `EnvelopeGlyph` (an envelope with its flap, the house stroke, 14 px, in the accent like the other pill glyphs) and nothing else; `aria-label` "Latest message", or "Latest message, new" while it is unread. `src/lib/messageSeen.ts` is the one owner of the read mark: `messageSeenKey(eventId)` is `wmsfo.messages.seen.<eventId>`, `readSeenMessageId(eventId)` reads it through `storageGet`, `markMessageSeen(eventId, messageId)` stores the id through `storageSet` (a no-op when the stored id is already that high, otherwise telling in-page listeners), and `subscribeMessageSeen(listener)` returns an unsubscribe. The message is unread while its id is greater than the stored id (absent means unread), and reading it anywhere on the site counts: the pill re-reads the mark through `subscribeMessageSeen`, so a `latest_message` section (7.4) that marks the message read clears the pill's dot on the same page without a reload. While unread a red ornament dot sits at the envelope's top right (8 px, `--err` ringed in the `--icon-snow` fill variable). When the message id rises while the pill is mounted the envelope shakes once (the `envelopeShake` keyframe, 600 ms; none under reduced motion, section 17) and the dot returns. The pill never opens anything on its own: a new message changes only the dot. Pressing it opens `MessagesDialog` on the shared dialog recipe (`<dialog>` with `showModal`, closing on a backdrop press, Escape, and Close; rendered inside the section, so it takes the map style's tokens as the cookie dialog does): the title "Flight updates" and one row (`data-testid="messages-dialog-row"`) holding the body through `Inline` as the `latest_message` section draws it, its time from `formatEventTime(createdAt)` (the message carries `id`, `body`, and `createdAt`, contracts 54), and a "New" marker while the message was unread when the dialog opened. Opening calls `markMessageSeen`, so the dot clears at once, while the "New" marker stays until the dialog closes. Hidden with the rest of the top-left stack while the tracker menu is open. The `latest_message` section (7.4) is not drawn on the live screen |
| `CookieTally` (`overlays.leaderboardPanel`) | `live.cookieTally`, `snapshot.cookieTypes` | The cookie tally under the tracker menu button, top-right: a bare column with no background, border, box, or header, under one collapse chevron (`data-testid="cookie-tally-toggle"`, `aria-expanded`, `aria-controls` the list, labelled `copy.map.cookieTally.hide` or `.show`), a bare 34 by 26 button in `--text-bright` carrying the same drop shadow as the counts, the chevron pointing up to fold the column away and down to bring it back. Collapsed, the chevron is all that is left of the tally and the leave-a-cookie button below is untouched. The choice is kept for the page load in `trackerToggles.ts` under `cookieTally` like the tracker's other choices, so a remount keeps it; nothing is persisted. Open is the default. One row per `snapshot.cookieTypes` entry ordered by `rankCookieTypes` (section 9: count descending, then `sort`, then `id`; a type with no cookies shows 0 and sorts last), each row the count through `formatCount` immediately left of the type's icon with a 5 px gap, the icon 28 px through the `Icon` primitive (a placeholder disc when it cannot resolve). Rows align to the right edge under the menu button, so a longer count hangs further left while the icons stay in one column. Legibility on every map style comes from shadow, not a box: the count in the mono pill font, `--text-bright`, tabular digits, with a three-layer `text-shadow` in the chrome's `--panel` colour, and the icon with a three-stop `drop-shadow` filter in the same colour (1 px for a tight edge against whatever is under it, then 4 px and 8 px to carry it over busy map detail). Counts update in place as live objects arrive; a change of order moves the rows with no animation |
| Leave-a-cookie glyph (`overlays.cookieControl`) | `live.eventStatusId`, auth, `snapshot.cookieTypes`, `GET /me/cookies` | Under the tally, with the same shadow and no box: one bare button, the cookie glyph with a small plus (`CookiePlusGlyph`), 26 px inside a 44 px hit area, drawn in `--cookie` (and `--cookie-bright` on hover) so it reads as a cookie rather than as another map control, `data-testid="cookie-tally-leave"`, present only while `live.eventStatusId === 3`. Its `aria-label` and `title` follow auth: "Leave cookies" signed in, `copy.cookies.signInToLeave` ("Sign in to leave cookies") while `auth.status` is `signedOut`, so the label says what the press does. It opens the cookie dialog of section 10, which asks a signed-out visitor to sign in. It is the only way to leave a cookie on the live screen |
| `SponsorCarousel` overlay | `snapshot.sponsors` | Section 15, the `tile` variant bottom-left, logos at the 480 px size |
| `TrackerMenu` | themes, map type, toggles, `live.speedMps/headingDeg/altitudeM/accuracyM`, distance, liftoff | The legacy tracker's card in the top-right corner (360 px, the full width on a phone, the frost recipe; 360 is the width the one-row footer needs, seven 44 px buttons with their captions and the route group's rules): the event's enabled themes for the active renderer (8.4) as round thumbnails with a nickname and an accent underline on the active one; a row of Terrain, Road, and Snow (Frost controls: `--panel-2` fill, fully round, no border, and `--accent-soft` with `--accent` text when selected or pressed, no underline); the data row as a glyph and a value per item (speed, heading, altitude, accuracy, distance, liftoff), every number through `formatCount` like the rest of the tracker, so an altitude of 10,499 ft reads "10.5k ft" here as well as on the dial, the liftoff the only time it carries: the fix diagnostics, when the beacon recorded a position and when this browser received it, are not shown; then the footer row of fixed 44 px round buttons in the same Frost look (pressed is `--accent-soft` with `--accent` text) (`flex: none`, never shrinking at any width; the glyph inside is 22 px on a phone and 19 px above 760 px, where the card is denser, the 44 px hit area the same at both), each under a short caption (`copy.tracker`: Sign in or Sign out, Gauges, Location, Route, Times, Viewpoints, Close; `aria-hidden`, the button's `aria-label` is the same word, so the caption and the accessible name never disagree; the groups align their buttons on one line), in two groups (`justify-content: space-between`, `align-items: flex-start`, a 4 px gap): the right group is one row that never wraps (`flex-wrap: nowrap`, `justify-content: flex-end`, a 4 px gap), the account button alone at the left, and on the right the gauges (`GaugeGlyph`, `aria-pressed`, `aria-label` from `copy.tracker.data`, "Gauges", `data-testid="tracker-menu-flight-dock"`, shows or hides the `FlightGauge`; present while the gauge has any instrument), location (opens `LocationPrompt`; `aria-pressed` while the visitor's location is on, `data-testid="tracker-menu-location"`), the route (`RouteGlyph`, two stops joined by a winding path, `aria-label` from `copy.tracker.history`, "Route": the projected route from a previous flight, off unless `data.flightHistoryDefault`), the viewpoints (`ViewpointGlyph`, binoculars, the map convention for a lookout, `aria-pressed`, `aria-label` from `copy.tracker.landmarks`, "Viewpoints", `data-testid="tracker-menu-viewpoints"`, the `landmarks` toggle of 8.5, first pressed; present while the site settings have at least one viewpoint and `data.controls.landmarks` is not false, the flag only hiding the button, so the viewpoints still draw without it), close. **The route group.** Route and the buttons it switches on are one `role="group"` labelled "Route" (`.footerGroup`, `data-testid="tracker-menu-route-group"`), in the row beside the others. While Route is on the group also takes `.footerGroupOpen`, a 1 px `--line` rule down each side with 5 px of padding, so the pair reads as a set rather than as more buttons in the row; with Route off there are no extras and no rules, and the toggle sits in the row like any other button. The group holds time labels (`TimesGlyph`, `aria-pressed`, `aria-label="Time labels"`, `data-testid="tracker-menu-time-labels"`), under the caption Times, present only while Route is on. The account button follows auth (11.3): signed out, the name-tag glyph (`SignInGlyph`) labelled `copy.signIn.button`, `data-testid="tracker-menu-sign-in"`, which closes the menu and calls `signIn` with the current path and search as `returnTo`, so the sign-in card opens as the auth dialog over the tracker (11.5); signed in, the mitten glyph (`SignOutGlyph`) labelled `copy.signIn.signOut`, `data-testid="tracker-menu-sign-out"`, which calls `signOut` and leaves the menu open; while auth is `unknown` the left group is empty. Each right-hand entry present only when its control is on, the flight history entries also only when `snapshot.event.flightHistory` is non-null, and viewpoints only when the site has viewpoints |
| `MapControls` | follow state | Bottom-right: zoom in and out stacked in one 44 px column while following; a single recenter button once the visitor has dragged (a drag stops following; recenter resumes it) |
| `RouteDisclaimer` | `storage` key `wmsfo.routeDisclaimerAck` | Dialog on the first live-screen visit per browser; "I understand" stores the key |
| `Snow` | tracker menu toggle, reduced motion | The site's snow layer, off by default on the live screen; the tracker menu's Snow toggle is the site's only snow control, and its choice lasts only while the event is live (7.7, seasonal layers) |
| `wakeLock` | mount | Section 8.8 |

Data row units: speed as mph from `speedMps`, heading as degrees plus cardinal from `headingDeg`, altitude as feet from `altitudeM`, accuracy as feet from `accuracyM`; a null field shows a placeholder from `copy.ts`. `recordedAt` and `receivedAt` are shown in the data row as times; they decide nothing.

**The takeover.** While `live.eventStatusId === 3`, in a preview session too, the live page renders its `map` section alone (`PageRenderer` drops every other section of that page), the section is fixed to the viewport (`position: fixed; inset: 0`), the shell renders neither header, banners, nor footer, and `<html data-takeover="live">` locks scrolling. The page does not zoom during the takeover, since the map has its own zoom: the takeover rule on `html` and `body` adds `touch-action: pan-x pan-y`, so a browser that honours it stops a page pinch there while the map keeps its own pinch on the canvas, and the shell installs `installPageZoomGuard` (`src/lib/pageZoomGuard.ts`) for as long as the takeover lasts, removing it with the `data-takeover` stamp. The guard adds non-passive listeners for WebKit's `gesturestart` and `gesturechange` and for `touchmove`, and cancels a gesture event, or a move with more than one touch, whose target is page-owned: not an element, inside `[data-map-overlay]`, or outside `[data-map-canvas]` (`MapView`'s canvas node). The viewport tag cannot do this: Safari ignores its `user-scalable` and `maximum-scale` for pinch on purpose. Outside the takeover none of it applies and the rest of the site stays zoomable. Nothing else on the site is visible or reachable until the status changes; the tracker menu is the only menu. The layout follows the legacy tracker: pills 8 px from the top-left corner (the live indicator with its watching count, the airborne pill, the distance pill, the fix status, and the messages pill, which is always last in the stack), the tracker menu button with the cookie tally and the leave-a-cookie glyph under it top-right, bottom-left the flight gauge above the sponsor tile, and zoom (while following) or recenter (after a drag) bottom-right. Both bottom stacks sit `--map-bottom-inset` (28 px) up rather than the usual 8 px gutter: Google's logo block measures 26 px and its attribution strip 14, both flush to the bottom of the map, so at 8 px the sponsor tile and the recenter button hung over them. The inset is the logo plus 2, as low as they go without touching it. Nothing spans the map: neither bottom stack is lifted by anything. On the map itself the airborne time and the distance are pills under the live pill, speed, altitude and heading are the gauge's three stacked dials, and accuracy shows only in the tracker menu's data row, which keeps the full table. Every pill is 34 px tall, every button 44 px, on the shared glass surface (`--panel` at 94 percent, a pre-blended fill with no backdrop filter, 18), and every colour on the live screen comes from the chosen map style's chrome (8.4), as the legacy tracker's did; the tracker menu is the style's panel colour, and its footer row holds the account button (sign in or sign out) alone on the left with the other round buttons on the right. While the menu is open the top-left pills, the cookie tally with its glyph, the flight gauge, and the map controls are hidden, as the legacy tracker did.

**Stacking order.** Inside the section, from the bottom: the map canvas (Google's `.gm-style` root or the MapLibre canvas, its own stacking context at 0, so nothing inside the map paints above anything over it), the corner stacks `.topLeft`, `.topRight`, `.bottomLeft`, `.bottomRight` at 2, the viewpoint popover (8.5) at 3, the unavailable panel (`.unavailable`) at 4, and the tracker menu at 5.

### 7.7 Shell, theme, footer

`Shell` wraps every route: skip link, `<header>` with the brand link to `/` from `settings`, the actions row (in order: the header links, the Sign in or Sign out button, the alerts bell, the theme picker, and the menu button), the menu button (`aria-expanded`, `aria-controls`), the `<nav>` menu panel from `content/nav.ts`, the `updatesPaused` and `preview` banners, the reload prompt when `schemaMismatch`, and a `<footer>` with `settings.footerLinks` and `settings.footerText`. While the event is live (7.6, the takeover) the shell renders only the page: no header, no banners, no footer, and the document does not scroll; the one exception is a preview session, whose Preview banner floats fixed over the tracker (7.8). Off the takeover the root is a column that fills the viewport and the page's `<main>` takes the slack, so the footer sits at the bottom of the viewport on a short page and after the content on a long one. **Sticky header.** The whole top bar (`.siteHeader`) is `position: sticky; top: 0` at `z-index: 10`: it keeps its place in the document flow, so nothing shifts at any width when it pins, and it stays at the top of the viewport while the page scrolls, above `main` (`z-index: 1`) and the ornaments backdrop (`z-index: 0`). Sticky positioning follows the document scroll, so iOS momentum scrolling keeps it pinned. The header carries no transform, filter, or containment, so the fixed menu panel inside it stays anchored to the viewport. `html` has `scroll-padding-top: var(--header-height)`, so anchor jumps and the skip link land below the header. The brand, the inline nav and its bucket, and the actions are unchanged. **Menu panel.** At 760 px and below the menu button opens the `<nav>` panel: a compact card fixed in the viewport's top right corner (`top` and `right` `var(--space-2)`, 180 px wide, never wider than the viewport less 40 px, `var(--radius-md)`, `var(--panel)` with a `var(--line)` border, and the `--shadow-raised` elevation, defined for both schemes in the token file). It holds one row per destination from `content/nav.ts` (home, the nav pages, `settings.navExtraLinks`, then Sign in or Sign out): each row is the whole tap target, at least 65 px tall, rounded, on the raised `var(--panel-2)` surface with a `var(--line)` border and the accent wash on hover, and starts with a 24 px icon slot (`data-testid="panel-row-icon"`) followed by the label. The slot draws the destination's icon through the `Icon` primitive (7.3: a library id inline in the accent, a media id through `<img>` resolved from `bundle.media`, with its dark version or invert in dark mode): a page's `icon` from the content document, for the home row the `icon` of the role page served at `/` now, a nav extra link's `icon` as configured, and for the account rows a bundled library icon (`gift-tag` on Sign in, `mitten` on Sign out; `SIGN_IN_ICON` and `SIGN_OUT_ICON` in `content/nav.ts`). Every row icon is drawn at the slot's 24 px (the icon's `display` box and `sizePx` are not applied there; `.rowIcon svg, .rowIcon img` fill the slot with `object-fit: contain`), so the rows match in both schemes. A destination without an icon, or with one that resolves to nothing, leaves the slot empty, so every label starts at the same inset. The inline nav and its More menu stay text only: no row or link there draws an icon. When the rows outgrow the viewport the panel scrolls within itself (`max-height` of the dynamic viewport less the inset, `overflow-y: auto`, `overscroll-behavior: contain`). While the panel is open the menu button keeps its box but is hidden (`visibility: hidden` through `data-panel-open`), since the panel occupies its corner. Opening slides the panel in from the right (the `panelIn` class, a transform from `translateX(calc(100% + var(--space-2)))` to rest, 500 ms `cubic-bezier(0.25, 0.46, 0.45, 0.94)`); closing slides it out to the right (the `panelOut` class, the same length and curve) and the panel is hidden once the slide ends, with a timer as a fallback. The panel's `data-panel` is `closed`, `open`, or `closing` and its `data-motion` is `in`, `out`, or `none`. Under reduced motion neither class is applied, so opening and closing are instant (section 17). The panel closes on Escape, on a tap or click anywhere outside the panel and its button, and on the choice of any row (a link closes it as it navigates; the sign-in and sign-out rows close it as they act); each path returns focus to the menu button once it shows again, and Tab cycles within the open panel. **At the breakpoint.** While the panel is open or closing the shell listens to `matchMedia("(min-width: 761px)")`; crossing into the desktop breakpoint (or opening with it already matched) closes the panel at once, with no exit slide (`data-panel` `closed`, `data-motion` `none`, hidden), and releases everything an open panel holds: the Tab trap, the Escape and outside press listeners, the breakpoint listener itself, and the menu button's `data-panel-open` and `aria-expanded`. Focus is not handed back, since the menu button is not displayed above 760 px. The panel never locks the page scroll, so there is no scroll state to restore. The panel therefore never stands open beside the inline nav. Tests: the header rule is sticky at the top with no transform; the panel is fixed top right, capped in width, and scrollable, with 65 px rows; the button hides while open; the slide classes carry the documented timing and are removed under reduced motion, where opening and closing are instant; outside press, row choice, and Escape close with focus on the button; crossing into the desktop breakpoint with the panel open (or closing) closes it at once and releases the trap, the listeners, and the hidden button; rows draw library icons inline and media icons through `<img>` at 24 px, the home row takes the served role page's icon, the Sign in row draws its library icon, and a row without an icon (or with an unresolved one) keeps an empty slot first so its label aligns; the inline nav and its measuring copy draw no link icons. Above 760 px the menu button is hidden and the inline nav filters the sign-in and sign-out entries out, so the actions area beside the theme picker renders the Sign in button (`data-testid="menu-sign-in"`) when signed out and a Sign out button (`data-testid="menu-sign-out"`, same recipe, calling `signOut`) when signed in.

**Nav bucket.** Above 760 px the inline nav (`src/app/PriorityNav.tsx`) is a priority-plus row: it takes the header's free width between the brand and the actions (at least room for the More button; the brand gives way first, its logo scaling down and its name wrapping), keeps as many items as fit on one line counted from the first, and collapses the rest, last first, into a More menu at the end of the row (`data-testid="nav-more"`, a button with `aria-expanded` and `aria-controls`, and a chevron). When every item fits there is no More button. The math is `visibleCount` in `src/app/navOverflow.ts`: the whole row when it fits, else the largest leading run of items that fits beside a gap and the More button, down to none. Widths come from a hidden copy of the full row plus a More button (`aria-hidden`, `inert`, clipped by its own box so it never widens the page), measured in a layout effect before paint, again whenever a `ResizeObserver` sees the nav or the copy change size, and when `document.fonts` finishes loading, so the row settles without a visible flicker; items never wrap (`white-space: nowrap`) and the nav never scrolls. The menu (`data-testid="nav-more-menu"`) uses the site's menu recipe (the theme menu's panel, border, radius, and shadow, 44 px rows with the accent wash on hover), right-aligned under More. It is keyboard reachable (More is a native button; the menu's links follow it in tab order) and closes on More, on a press outside More and the menu, on the choice of any item in it, and on Escape, which returns focus to More; it starts closed whenever More comes back. At 760 px and below the inline nav, and More with it, is not displayed; the menu panel takes its place. Tests: the collapse math moves items into More last first and restores them as the width grows; the component collapses and restores on resize, keeps the copy out of the accessibility tree, and closes the menu on each path.

**No sideways scroll.** From 320 px up no page scrolls horizontally, without an `overflow-x` rule on `html` or `body`: the header's actions never shrink and the brand is the part that gives up width (the logo scales down in its box; the site name never wraps: the shell measures it on one line at every header resize and, when it would not fit, hides it (`data-fit="no"`) so the logo stands alone, the link keeping the site name as its accessible name); the page's `<main>` breaks a word longer than its line (`overflow-wrap: break-word`), and the flex rows of the rich text and links blocks (headings with an icon, icon list items, link buttons, list links) let a long word break inside the row (`min-width: 0`, `overflow-wrap: anywhere`) rather than run past the card. The e2e suite checks `scrollWidth` against the viewport at 320, 375, and 390 px on every ordinary page (22.2).

**Alerts bell.** `AlertsProvider` (`src/alerts/AlertsProvider.tsx`, mounted by `App` inside `AuthProvider` around the shell) exposes `useAlerts()` with `{ alerts, subscribed, unreadCount, markSeen }`. While `useAuth()` is `signedIn` it fetches `GET /me/subscriptions` and `GET /me/alerts` in parallel: once per sign-in, again when the document becomes visible after at least five minutes hidden, and once 60 seconds after the store's `snapshotUrl` changes (a status change or a posted message is what produces alerts, and the outbox sends within a minute; a further change inside the wait restarts it). A live poll or any other store update never fetches. Nothing is fetched while signed out, and signing out clears both lists. A failure or `SignInRequired` never throws: the lists stay as they were, empty until a fetch succeeds. `subscribed` is true when a subscription has `verifiedAt` set and `unsubscribedAt` null. Unread alerts are those with an id greater than the number stored under `localStorage["wmsfo.alerts.seen"]` (read through `storageGet`; absent means every alert is unread), and `markSeen` stores the newest alert id there. The `alerts_signup` section (13.1) keeps its own fetches. `AlertsBell` sits in the header actions between the sign-in control and the `ThemePicker`, at every width, and renders only while signed in and when `subscribed` is true or `alerts` is not empty. It is a 44 px icon button on the `.themeToggle` recipe (`data-testid="alerts-bell"`, `aria-label` "Alerts", or "Alerts, 2 new" while there are unread alerts) drawing `BellGlyph` (`data-testid="alerts-bell-glyph"`), a classic notification bell outline (the dome with its lip and a small clapper below) in the house stroke (24 px grid, 1.75 px, round caps and joins, `currentColor`) at 20 px. While `unreadCount` is above zero a plain round count badge overlaps the bell's top right: 16 px at the least, filled `--err`, the count in white through the `--icon-snow` fill variable (defined in the token file), "9+" past nine. When `unreadCount` rises while the bell is on screen it swings once (the `bellSwing` keyframe, a 700 ms rotation about the glyph's top; no swing under reduced motion, section 17). The bell never opens on its own; pressing it opens `AlertsDialog` on the shared dialog recipe (`<dialog>` with `showModal`, closing on a backdrop press, Escape, the close X, and Close; 600 px wide on desktop, the full width less 16 px a side on a phone, and at most 80 percent of the viewport tall, with the head and the Close row staying put while only the rows scroll in the recipe's `.scroll` region): the title "Your alerts" with a close X at the head's end (`copy.alerts.close` as its `aria-label`, `data-testid="alerts-dialog-close-x"`, on the icon button recipe, closing as Close does), the alerts newest first, each with `sentAt` in the viewer's timezone, the event name, the subject line, the alert's `message` under it when non-null (the event message's body, or the message that came with a status alert, at full length in `--text-dim` with line breaks kept; nothing when null), the kind label of 13.1 (an `event_message` alert reads "update", an `event_status` alert "status", through the same `alertKindLabel`), and a "New" marker on each one unread when the dialog opened; "No alerts have been sent to you yet" when there are none; and a footer with Close alone (the dialog carries no link to the alerts form). Opening calls `markSeen`, so the badge clears at once, while the "New" markers stay until the dialog closes. At 320 px the actions row holds the header links, the bell, the theme toggle, and the menu button (the Sign in and Sign out buttons hide at 760 px and below); the brand gives way as above, so no page scrolls sideways. Email is unchanged: subscribers keep receiving status alerts and event messages by email, and the bell lists exactly the alerts `GET /me/alerts` reports as sent.

**Header actions.** The header actions compose the recipes of 7.3: the Sign in and Sign out buttons (`.signIn`) and the header links (`.headerLink`) compose `.btn`, the theme toggle, the alerts bell, and the menu button (`.themeToggle`, `.menuButton`) compose the icon button, the preview banner's exit button (`.bannerAction`) composes the pill recipe in the accent tone as a 44 px button (its tint mixed over the panel so it reads on the accent banner), the theme menu is a `--radius-md` popover whose options keep the accent wash on hover, and the sponsor dialog's Visit and Close compose `.btnFill` and `.btnQuiet`.

**Header links.** `HeaderLinks` (`src/app/HeaderLinks.tsx`) renders `settings.headerLinks` (contracts 52: `Link[]`, 0 to 3; absent or empty renders nothing; the starter content holds the flyover's Facebook page with the library `facebook` icon) first in the actions row, before the sign-in control, at every width; the menu panel carries no header link rows. Each link, in order, is one `<a>` (`data-testid="header-link"`) with `href` as given, `aria-label` and `title` set to the label, and `target="_blank"` with `rel="noopener"` when `newTab`. It is a 44 px round button composing the secondary button recipe (7.3, the `.headerLink` class: the accent on `--accent-soft`) at the icon button's exact geometry, so it is the same size as the controls beside it and the accent wash alone tells it apart. It draws the link's icon at 18 px through the `Icon` primitive without the icon's display box (a library id inline through the generated components, a media id through `<img>`); a link without an icon, or with one that resolves to nothing, draws the label's first letter, upper case, in an 18 px circle (`data-testid="header-link-letter"`). The label is never drawn at any width: it is the button's accessible name and its title, and the button holds the icon alone. Below 400 px the header and the actions row close their gaps to `var(--space-2)` and the brand mark may shrink with the brand, so at 320 px three header links, the theme picker, and the menu button fit and no page scrolls sideways. Tests: no links renders nothing; three links render three anchors in order with their labels, icons, and new-tab attributes; an unresolved icon draws the letter; the label is never rendered and the stylesheet has no label or wide-screen rule; the actions row order is header links, sign-in, bell, theme, menu.

**Brand.** When `settings.logoMedia` is set the brand link shows the Logo (7.3, `data-testid="brand-logo"`) 32 px tall, 28 px below 640 px, in place of the built-in mark, followed by `settings.siteName` unless `settings.headerShowsSiteName` is `false` (absent or `null` means true). With the name hidden the link carries `aria-label` set to the site name, so its accessible name stays the site name. When `logoMedia` is absent or `null` the link shows the built-in `BrandMark` (the Montana outline with the gold star) and the site name, whatever `headerShowsSiteName` says. `settings.logo` is not drawn in the header.

**Ornaments.** `OrnamentsLayer` (`src/content/theme/OrnamentsLayer.tsx` with `OrnamentsLayer.module.css`, rendered by `App` beside the snow layer) draws five Christmas ornaments hanging behind every page except the live screen, when `settings.theme.ornaments` is true. The layer is `position: fixed; right: 0; bottom: 0; left: 0; pointer-events: none; aria-hidden`, below `main` and above the page background in the stacking order (`z-index: 0` with `main` at 1), so it never takes a click and never moves layout. The whole layer is a backdrop: it is dimmed to `var(--orn-opacity)` (0.55 in light, 0.4 in dark) and its top offset follows `var(--header-height)`, a variable the shell sets on the document root from the header's measured height on mount and through a `ResizeObserver`, so the strings start below the header band rather than at the viewport top. Each ornament is inline SVG: a thin string from the top edge, a small metal cap, and a sphere with one soft highlight. Positions are fixed viewport percentages spread across the width (left 6 %, 22 %, 58 %, 78 %, 93 %); the cards in front of the layer are opaque, so the ornaments show in the hero band and in the gaps between cards. String lengths are 96, 64, 36, 72, 110 px (the blue one hangs short so its sphere clears the hero title) and spheres are 64 to 84 px. Colours come from the token file, the same hues the header lights use: `--orn-red`, `--orn-green`, `--orn-blue`, `--orn-gold`, `--orn-frost`, defined for both schemes (10 % darker in light so they sit on the pale ground); no hex values in the component. Below 640 px the module scales the whole layer by 0.5 and the token file drops `--orn-opacity` to 0.3, so the header and the first card stay clear on phones. Each ornament sways about its string by ±3° on a `transform: rotate` keyframe of 7 to 11 s, staggered per ornament, and the keyframe is removed under reduced motion (section 17). Tests: renders five ornaments when the setting is on and the page is not live, none otherwise; each sphere carries one of the five token classes; the layer carries `opacity: var(--orn-opacity)` and `top: var(--header-height, 0px)`; the module scales the layer to 0.5 below 640 px.

**Colour scheme.** The site has one visual direction, North Pole Night, in a dark and a light rendering, and the visitor chooses light, dark, or follow the system. `data-theme="light"` or `"dark"` on `<html>` is the resolved scheme. An inline script in `<head>` of `index.html`, before any stylesheet, reads `localStorage["wmsfo.theme"]` (`"light"` or `"dark"`; absent or anything else means system) and `matchMedia("(prefers-color-scheme: dark)")` and stamps the attribute, so the first paint is already right. `content/theme/colorScheme.ts` owns the rest: a `change` listener on the media query keeps a system-following visitor live; the header's theme picker (`ThemePicker`: a sun or moon button that opens a small menu of Light, Dark, and System with the current choice checked) stores light or dark, and System removes the stored key. There is no other scheme control anywhere on the site. Nothing about the scheme is in the snapshot or the site settings. Non-CSS consumers (the map's overlay palette, canvas snow) follow the attribute through a `MutationObserver`, as the portfolio does. Each theme root declares its `color-scheme` (`light` or `dark`), so native controls and the page scrollbar follow the theme, and one global rule in the token file gives every scrollbar on the site (the page, the dialogs, the menu panel, the tracker menu, the viewpoint popover) a thin thumb in the line colour lifted toward the dim text (`color-mix(in srgb, var(--text-dim) 70%, var(--line))`, 3:1 on `--panel` in both themes, checked by `tokens.contrast.test.ts`) on a transparent track, the dim text colour on hover, resolved per element so the tracker's rebound tokens recolour its menu's scrollbar.

**Tokens.** `content/theme/tokens.css` is the only file in the repository with a colour literal: the dark palette on `:root[data-theme="dark"]` and the light palette on `:root[data-theme="light"]`, the same token names in both (`--ground`, `--panel`, `--panel-2`, `--line`, `--text`, `--text-bright`, `--text-dim`, `--accent`, `--accent-soft`, `--on-accent`, `--gold`, `--link`, `--ok`, `--warn`, `--err`, `--shadow`, `--shadow-raised`, `--snow`, `--frost-a`, `--frost-b`), plus the type scale, spacing, and the two radii (6 and 10 px). The values are the North Pole Night set:

| Token | Dark | Light | Role |
|---|---|---|---|
| `--ground` | `#070d1c` | `#eef3fa` | page background |
| `--panel` | `#0f182e` | `#ffffff` | cards, header, footer |
| `--panel-2` | `#16213c` | `#f5f8fd` | raised panel, inputs, logo tiles |
| `--line` | `#243252` | `#d3ddee` | borders, rules |
| `--text` | `#c9d5ec` | `#2c3850` | body text |
| `--text-bright` | `#eef3ff` | `#0f1a30` | headings, values |
| `--text-dim` | `#8393b5` | `#5a6885` | labels, secondary text |
| `--accent` | `#6fd3ff` | `#0b6bb5` | the accent: eyebrows, active nav, buttons, icons |
| `--accent-soft` | `rgba(111,211,255,.14)` | `rgba(11,107,181,.11)` | accent washes, hover fills |
| `--on-accent` | `#070d1c` | `#ffffff` | text on a filled accent button |
| `--gold` | `#f0c05a` | `#8a6210` | funds ring fill, the star in the brand mark |
| `--link` | `#9cc7ff` | `#0b6bb5` | prose links |
| `--ok` | `#56d29a` | `#1c7548` | status good, live dot |
| `--warn` | `#f0c05a` | `#8a6210` | status degraded, disclaimer |
| `--err` | `#ff7a70` | `#ba3329` | status down, validation errors |
| `--shadow` | `none` | `0 1px 3px rgba(15,26,48,.08)` | panels (dark has no shadows) |
| `--shadow-raised` | `0 10px 28px rgba(0,0,0,.5)` | `0 10px 28px rgba(15,26,48,.18)` | the elevated menu panel |
| `--snow` | `rgba(255,255,255,.85)` | `rgba(140,165,205,.55)` | snow flakes |
| `--frost-a`, `--frost-b` | `rgba(111,211,255,.4)`, `rgba(255,122,112,.28)` | `rgba(11,107,181,.2)`, `rgba(194,54,44,.14)` | the aurora halo behind frost glass |

`docs/design/theme-studio.html` is the reference rendering: every page and home state built on these tokens with the exact component recipes (header, hero with the liftoff card, live strip, Cheer Meter ring, sponsor cards, alerts form, footer, the live map overlays, the poster viewer, the icon set). It is a static mock kept in the repository for the build and for review; the site's CSS modules reproduce its recipes through the tokens, never by copying its literals. Open it in a browser with the "North Pole Night" direction and "Bricolage" face selected. `tokens.contrast.test.ts` parses the file and fails the build when any text token on any surface token drops under 4.5:1 or a status token on `--panel` under 3:1. A hex anywhere else is a review failure. Components are CSS modules co-located with the component (`X.module.css`, typed by `typed-css-modules` so an unknown class fails `tsc`); there is no UI library and no utility framework.

**Type.** IBM Plex Sans for prose and UI, IBM Plex Mono for every value that came from the API at runtime (countdown, funds, speed, distance, times, timestamps) with `font-variant-numeric: tabular-nums`, Bricolage Grotesque for `<h1>` and `<h2>` only. All three are self-hosted through `@fontsource` (section 21; `font-src 'self'`). Body 16 px on 1.5; labels 13 px mono uppercase with 0.12 em tracking; the spacing scale runs 4, 8, 12, 16, 20, 24, 36, 48 px and the section frame pads 20 px vertically at normal spacing.

**Section card.** The section frame's card (7.2) is the base panel recipe: `background: var(--panel)`, `1px solid var(--line)`, `var(--radius-md)`, `var(--shadow)`, `var(--space-5)` of padding on desktop and `var(--space-4)` below 640 px, and `overflow: hidden` so a media background clips to the rounded corners. A token background swaps the fill (`surface` = panel, `muted` = panel-2, `accent` and `night` keep their text colours). Consecutive card frames sit `var(--space-4)` apart; the outer page gutter is unchanged. The frame writes `data-card="true"` on the section when it renders the card and `"false"` on `hero`, `map`, `divider`, and the `countdown` paired with a hero (the `heroCountdownPair` layout). Section components no longer paint outer chrome where the frame supplies it; inner item cards (the `cards` style of `links`, `sponsor_grid`'s sponsor tiles, the leaderboard rows) keep their own treatment because they are items, not the section.

**Seasonal layers.** Off the live screen snow follows the published `settings.theme.snowDefault` and nothing else: the menu panel and the footer carry no snow control. The only snow control is the tracker menu's Snow button on the live screen (7.6), shown by its own rules. On the live screen snow is off by default and the visitor's choice there is held in memory for the live takeover only: it is never persisted, it is cleared when the takeover ends, and any `wmsfo.snow` key left in `localStorage` is removed and never read, so once the event is not live the site renders `snowDefault` again. `settings.theme.lightsDefault` turns the string of lights under the header on or off for everyone; the visitor has no lights switch. Snow is a canvas of small, slow, translucent flakes coloured by `--snow` (half-strength white in dark, a faint blue-grey in light, about one flake per 30,000 square pixels), fixed at `z-index: 0` so it falls over the ground and the section backgrounds but behind every positioned surface: the cards, the header, the footer, and the text; on the live screen it sits over the map. Lights are a row of 7 px bulbs on a 1 px wire in the accent, gold, ok, and err tokens with a slow twinkle. Frost glass (an aurora halo in `--frost-a` and `--frost-b` blurred 12 px just outside the panel, over it a glass layer of `--panel` at 90 percent (pre-blended, no backdrop filter, 18) and a border tinted 40 percent toward the accent; both are pseudo-elements of the `.frost` class in `theme/Frost.module.css`, so a composing class sets only its own padding) dresses the paired countdown card beside the hero (7.2) and the sponsor grid's tiles. The live screen's surfaces follow the map style instead (7.6, 8.4). `settings.favicon` replaces the `<link rel="icon">` href with the resolved icon URL when set; the defaults are applied whenever the bundle changes.

**Motion.** Hover is a 120 ms ease-out change of background or colour (the tint of 7.3) and nothing moves more than 2 px; focus is a 2 px accent outline with a 2 px offset; the hero rises 12 px on load with a 60 ms stagger; the funds ring and leaderboard reorder animate as section 17 says. Every tap target is at least 44 px.

**Icons.** Library icons are inline SVG components generated at build time from the vendored `contracts/icons/<id>.svg` files (the API repository publishes its icon library there beside the schemas, so the contracts check covers them) (24 px grid, 1.5 px stroke and soft tints in `currentColor`, round caps and joins, plus fixed red, gold, green, snow, and cocoa fills through `--icon-*` CSS variables with fallbacks), so the strokes take the accent and the fills read the same inline or through `<img>`; the `Icon` primitive renders a library id inline and a media id through `<img>`. A library id missing from the generated set falls back to `<img>` from `bundle.icons`.

### 7.8 Preview

**The session.** A preview is a session of the browser tab, not a page. `/preview?token=wpv_...&page=<slug>&theme=<light|dark>` starts it: `PreviewPage` stores the token and the optional theme in the tab's session state and in `sessionStorage` under the one key `wmsfo.preview` (reads and writes wrapped in `try`/`catch`, so a blocked storage only loses the resume), waits for the first draft, and navigates with `replace` to `/` when no `page` is named and to `/<slug>` otherwise; a role page's slug renders that role page inside the session in every status except live, so the planned, ended, or cancelled page can each be checked before its day (an unknown slug renders `NotFound`; while live the takeover wins, below). A session already in the tab is replaced by a new token; the same token only updates the theme. On load the app resumes the session kept in `sessionStorage`, so a reload of any page in the tab stays in preview. While a session is active `store.preview` holds the draft and `selectBundle` prefers it everywhere, so every route, the menu, and the footer render from the draft with no per-page change; links and the menu keep their normal paths and stay inside the session. Live sections read the real store, so the map, tally, and sponsors are live data under draft content. The data loop runs as usual.

**A live event in a preview session.** The takeover applies in a preview session exactly as on the published site: the moment the event goes live the session switches to the fullscreen tracker built from the draft's live page (its `map` section alone, 100dvh, no header or footer), so preview is the real live experience over the draft content. The one addition is the Preview banner, which floats fixed over the top of the tracker (`.takeoverBanners`) so Exit preview stays reachable; the updates-paused banner never shows there. While live, other draft pages are not reachable inside the session, the same as the real site; they come back when the status leaves live.

**Following the draft.** `PreviewSession`, mounted once above the routes in `App`, owns the poll and survives navigation. It calls `GET <api>/preview/document?token=` (the one CDN-free read on the site; `credentials: "omit"`, no bearer). While `document.visibilityState` is `visible` it fetches the document again every 2000 ms (the next fetch is scheduled when the previous one settles), stops while the tab is hidden, and fetches once at once when the tab becomes visible again. Each request sends `If-None-Match` with the last `ETag` the API returned (none when the last response carried no `ETag`); a `304` means no change. On a `200` the body text is compared with the last body and `store.preview` is replaced only when it differs, so an unchanged draft never re-renders; a replaced bundle updates the page in place, with no navigation, no reload, and the scroll position kept. A failed fetch (network error, timeout, any status other than `404`) keeps the last good draft and tries again on the next tick; after five failures in a row the Preview banner shows "Reconnecting", cleared by the next success (with no draft yet, `/preview` shows the error with a Retry button instead).

**The banner.** While a session is active the Preview banner shows on every page: "Preview", then "Live, last change hh:mm:ss" (the time the last changed bundle was applied, on a 24-hour clock in the viewer's timezone), "Reconnecting" when it applies, and an "Exit preview" button. Exit ends the session: it clears the `sessionStorage` key, `store.preview`, and the theme override, stops the poll, and stays on the current path, which now shows the published site.

**Expiry.** A `404` ends the session: polling stops and does not retry, the `sessionStorage` key, `store.preview`, and the theme override are cleared, and the page falls back to the published site. The banner then reads "This preview link has expired" with the same Exit action, which dismisses it. A link that is already expired lands on `/` with that banner; `/preview` with no token renders "This preview link has expired" and starts nothing.

**Theme and robots.** A `theme=light` or `theme=dark` parameter (the panel's light and dark toggle) applies that theme through `setTheme` without storing it for as long as the session is active, and the visitor's stored choice applies again when it ends; any other value is ignored. Search engines never see a preview: `<meta name="robots" content="noindex">` is present on `/preview` and on every page while a session is active. `/preview` is the one path the admin panel may frame: `vercel.json` sends `X-Frame-Options: DENY` on every other path and `Content-Security-Policy: frame-ancestors 'self' https://*.vercel.app` on `/preview`.

---

## 8. Map layer

### 8.1 Loading

**Renderer choice.** `src/map/renderer.ts` decides, once per page, which renderer a surface gets:

```ts
// src/map/renderer.ts
export function pickRenderer(snapshot): "maplibre" | "google" {
  const ev = snapshot.event;
  const hasMl = ev?.trackerMap != null && snapshot.trackerThemes.some(t => t.renderer === "maplibre");
  return hasMl && canUseWebGl2() ? "maplibre" : "google";
}
```

`canUseWebGl2()` creates a `webgl2` context on a detached canvas with `failIfMajorPerformanceCaveat: true`, reads nothing else, loses the context, and caches the answer for the page life. The choice is reported once per page through `sendEvent` as a `map_renderer` event (section 16) with `surface` (`route` or `live`), `renderer`, and `reason` (`ok`, `no_map`, `no_theme`, `webgl2_unavailable`). The same choice drives the route preview (8.9) and the tracker, so the route page, public for weeks before the event, measures the WebGL 2 rate across the real audience before event night. `maplibre` loads the host of 8.10; `google` loads the Maps libraries below. A viewer never downloads both unless they fall back.

**Runtime fallback**, on both surfaces: a `webglcontextlost` without `webglcontextrestored` within 5 s, a failed load of the MapLibre chunks, or a style load failure tears the MapLibre host down and builds the Google controller in its place with the event's Google themes, keeping the viewer's stored theme key when a Google theme has it and resolving the default otherwise (8.4). A `map_renderer_fallback` event records `surface` and `reason` (`context_lost`, `chunk_failed`, `style_failed`). A Google failure after that keeps the "map unavailable" panel on the tracker (below) and the route preview's `emptyText` on the route page (8.9).

**Google Maps.**

```ts
// src/map/loadMaps.ts
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
export const LOAD_TIMEOUT_MS = 15_000;
export async function loadMaps() {   // one attempt in flight; a failure clears it
  setOptions({ key: env.GOOGLE_MAPS_KEY, v: "weekly" });   // once
  const libs = Promise.all([importLibrary("maps"), importLibrary("marker"), importLibrary("geometry")]);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Google Maps did not answer in 15 s")), LOAD_TIMEOUT_MS));
  const [maps, marker, geometry] = await Promise.race([libs, timeout]);   // the timer is cleared on settle
  return { maps, marker, geometry };
}
```

`src/map/**` is imported with `import()` from `sections/Map/Map.tsx` and, in route mode on Google (8.9), from the route preview; nothing imports it statically. The three library imports race a 15 s timer (`LOAD_TIMEOUT_MS`), so a script that loads without Google's callback firing fails with "Google Maps did not answer in 15 s" instead of hanging; any failure clears the attempt in flight, so the next call starts a new one. A map can fail by two paths, and both end in the same "map unavailable" panel (7.6). **Load:** a library-load failure retries by itself up to three times with doubling backoff from one second (`MapView`), so a network blip at the moment the live screen mounts heals without anyone noticing; only after those attempts is the error surfaced, reported, and the map area renders the panel. **Render:** the `map` section sits inside an error boundary (`sections/Map/index.tsx`): a failed load of the `map` chunk, or any throw while the section renders or runs its effects (a live flip included), is reported and renders the panel in the section's place (fixed over the viewport during the takeover) instead of a blank page. The panel shows the reason in one line under its title (`describeError` in `src/lib/analytics.ts`: an `Error`'s name when it says more than "Error" plus its message, a non-empty string as it is, else "Unknown error", at most 160 characters), and its one button, "Reload the page", reloads the page (`reloadPage` in `src/lib/reload.ts`). There is no in-place retry: every browser keeps a failed dynamic import in its module map, so importing the chunk again rejects without a fetch, and a reload is the only cure. Each surfaced failure is reported once by `reportMapError(source, error)`: one `console.error` line and a `map_error` event (section 16) with `map_error_source` (`load` or `render`) and `map_error_reason` (the panel's reason line). The automatic retries are not reported. A load that settles after the section has unmounted builds nothing. The data row, leaderboard, message, carousel, and cookie control still work because they read the store, not the map. Google's console notice deprecating `google.maps.Marker` is expected and ignored (section 24: advanced markers require a cloud map id, which would disable the themes' JSON style arrays, 8.2), and a transient 500 from Google's internal `GetViewportInfo` telemetry call does not affect the map.

### 8.2 Map options

```ts
{
  center: data.defaultCenter,        // the map section's data; replaced by the first fix or the route bounds
  zoom: data.defaultZoom,
  restriction: { latLngBounds: bbox, strictBounds: true },   // the event box, snapshot.event.trackerBbox (Bounds below)
  minZoom: fittedMinZoom(bbox, viewport),                     // the zoom that fits the box, never below 5
  mapTypeId: "terrain",
  disableDefaultUI: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  keyboardShortcuts: true,
  styles: poiStyles(style, pois),        // the theme's fetched JSON style array (8.4); no mapId
}
```

`styles` is the theme's array followed by the place filter, which comes from the site settings' `settings.places.tracker` (7.6) (`src/map/poiStyles.ts`, whose `POI_KINDS` is the one list of the nine kinds): with the filter null the theme's array alone; with a filter, one `{ featureType, stylers: [{ visibility: "off" }] }` rule per kind not in its list, `featureType` being `poi.<kind>` for the eight `poi` kinds and `transit` for `transit`.

Classic `google.maps.Marker` and `google.maps.Polyline` with JSON `styles` (a `mapId` would disable JSON styling; the arrays are theme rows fetched from the CDN, 8.4).

Initial view: when a fix exists, centre on it at `data.defaultZoom`; otherwise `data.defaultCenter` at `data.defaultZoom` (on MapLibre, the box fitted; 8.10).

**Bounds.** Both controllers take `snapshot.event.trackerBbox` (`{ west, south, east, north }`, required on every event; contracts 1.3) at build and apply it the same way. Google: `restriction: { latLngBounds: bbox, strictBounds: true }` and `minZoom` set to the zoom that fits the box in the current viewport, computed from the viewport size and the box's Mercator extent, recomputed on resize, never below 5; `panTo` while following clamps to the box. MapLibre: `maxBounds: bbox` and `minZoom` computed the same way (8.10). Shared: `recenter` and `fitHistory` clamp their targets to the box; a flight history point outside the box is drawn but not fitted to; the user location marker outside the box draws at the edge with the distance chip still accurate; a fix outside the box pans to the nearest in-box point and the marker sits on the edge, so a beacon that leaves the area never blanks the map. In route mode the box is the pan limit and the minimum zoom only; the view stays fitted to the path (8.9).

### 8.3 Controller

`MapController` (`src/map/mapController.ts`) is one interface with two implementations: `createMapController` over a `google.maps.Map` and `maplibreController` over the MapLibre host (8.10). `Map.tsx` and the tracker menu call the interface and never know the renderer. It is, in full: `setTheme(theme)` (async: it awaits the theme's style body, 8.4), `setPois(filter)`, `setMapType("terrain" | "roadmap")` (the terrain switch for both implementations: MapLibre maps `"terrain"` to its terrain layers in and `"roadmap"` to out; there is no `setTerrain`), `setFlightHistory(points)`, `setToggles(t)`, `setLiveFix(state, pos, seqChanged)`, `follow(on)`, `recenter(pos)`, `zoomBy(delta)`, `fitHistory()`, `setViewpoints(list)`, `enableUserLocation()`, `disableUserLocation()`, `getUserLocation()`, `destroy()`. The map object itself is not on the interface: whatever needs it is a method, because the MapLibre implementation has no Google map to expose. The Santa marker, the flight history overlay (8.5), the viewpoints (8.5), the user location (8.6), and the place filter sit behind the interface, each in a Google and a MapLibre form. Each implementation subscribes to the store once and, on each applied object whose `seq` changed, calls `santaMarker.setPosition` and, while following, `map.panTo`. `dragstart` sets `follow(false)`; the recenter button sets `follow(true)` and pans. `zoom_changed` (debounced 150 ms) redraws the flight history overlay so arrow density and label interval match the zoom. `destroy()` removes the map listeners and the pending zoom redraw and detaches the marker, the overlay, and the user location; after it every method is a no-op, so a late call or a late map event on a disposed controller (a rapid live flip) draws nothing and calls back into nothing. A build that fails part way detaches what it had already put on the map before `MapView` retries. `setPois(filter)` keeps the place filter the section resolves from `settings.places.tracker` (`{ kinds }`, or null while that key is absent) and calls `map.setOptions({ styles })` with the current theme's styles plus that filter (8.2); `setTheme` re-applies the same filter on top of the new theme's styles; on MapLibre the same call sets the filter on the theme's `wmsfo:places` layers (8.10). `setViewpoints(list)` compares the list against what is drawn (place, name, icon, description) and returns without touching the map when they say the same thing, so a repeated list leaves the badges alone and an open viewpoint popover stays open; only a real edit rebuilds the overlay. The user location ignores a permission answer that arrives after `destroy()`: no watch starts and no change is reported.

### 8.4 Themes

Map styles are separate from the site's colour scheme: the picker in the tracker menu stays, exactly as the legacy tracker had it, and the chosen style does not change when the visitor flips light and dark (the appearance only picks the starting style for a visitor who has never chosen one). The themes are rows the admin panel manages, one per renderer, `google` or `maplibre`; the snapshot carries the current event's enabled ones in admin order as `snapshot.trackerThemes` (contracts 1.3), each with its chrome, its overlay palette, a `styleUrl` on the CDN, a `spriteUrl` (MapLibre, else null), a `thumbnailMediaId`, and the two default flags. `src/map/themes/index.ts` is a loader over that list, not a registry: nothing about a theme is in the repository, and a new theme is a panel edit, not a deploy. A Google theme's style body is a JSON style array (`google.maps.MapTypeStyle[]`); a MapLibre theme's is a full style (8.10). Each theme carries the overlay palette the flight path layer needs plus a `chrome` palette: what the tracker's pills, panels, tiles, buttons, and dialogs paint with while that style is on. The map section rebinds the site's surface tokens (`--panel`, `--panel-2`, `--text`, `--text-bright`, `--text-dim`, `--line`, `--accent`, `--accent-soft`, `--shadow`) to the chrome on its root, so everything inside it follows the map style and nothing inside it follows the site's light or dark scheme. The picker shows the enabled themes of the active renderer as round thumbnails in a three by two grid, each the `480` variant of its `thumbnailMediaId` resolved through the snapshot's `media` map (contracts 1.3b), the way a sponsor logo is; a theme without a thumbnail shows a swatch of its chrome. The `map` section's data no longer names themes (its `themes` and `defaultTheme` keys are gone): the event's enabled list is the offer. The themes' own `poi` and `transit` rules are the base the section's place filter (8.2) subtracts from.

```ts
export type MapTheme = {
  key: string;                        // the row's slug, stable across edits; what the stored choice names
  renderer: "google" | "maplibre";
  name: string;                       // the menu's nickname
  styleUrl: string;                   // themes/<sha>.json on the CDN, immutable
  spriteUrl: string | null;           // MapLibre only
  thumbnailMediaId: string | null;    // resolved through snapshot.media
  defaultLightMode: boolean; defaultDarkMode: boolean;
  overlay: { routeColor: string; routeOpacity: number; arrowColor: string; timeLabelBg: string; timeLabelFg: string; timeLabelOpacity: number; userColor: string };
  chrome: { bg: string; fg: string; text: string; tile: string; tileFg: string; panel: string; accent: string };
  getStyle(): Promise<google.maps.MapTypeStyle[] | StyleSpecification>;   // fetches styleUrl once and caches the body
};
```

The style body is fetched on demand through `getStyle()`, once per theme per page, so `setTheme` awaits the body and the menu's theme switch awaits `setTheme`; the controller is built only after the starting theme's body is in hand, fetched in parallel with the renderer's own load. A Google array is a few KB; a MapLibre style is 100 to 200 KB and cached immutably under its hash.

The chosen key persists in `localStorage["wmsfo.tracker.theme"]` through `lib/storage.ts` (guarded). The starting style resolves per renderer in this order (`resolveInitialTheme`): (1) the stored key, when it names an enabled theme of the active renderer; (2) the enabled theme carrying `defaultDarkMode` when `<html data-theme>` is `dark` (which already accounts for the viewer's Light, Dark, or System choice) and the one carrying `defaultLightMode` otherwise; (3) the first enabled theme in admin order. The API keeps at most one holder per renderer for each flag, and one theme may carry both. A blocked storage or a stored key the event no longer enables therefore starts from the appearance. Picking a style in the tracker menu stores it, and a stored choice always wins over the appearance. Theme changes await the body, apply it (`map.setOptions({ styles })` on Google, a style swap on MapLibre), redraw the flight path overlay, and recolour the user marker and dotted line.

**Overlay palettes.** Everything the site draws over a map (the flight path and its arrows, the time labels, the user marker and dotted line, and the tracker chrome: chips, the menu card, the tiles in it, the accent) takes its colours from the theme's `overlay` and `chrome`. The six Google themes the API seeds are the legacy tracker's style arrays under their current keys with the palettes below, chosen against each map's dominant tint so text keeps a contrast of at least 4.5:1 on its chrome and the path reads against both land and water; `standard` carries `defaultLightMode` and `night` `defaultDarkMode`. The table is the seed's record: an edit in the panel changes a value without a site deploy.

| Theme | Map tint | `routeColor` (opacity) | `arrowColor` | `timeLabelBg` / `timeLabelFg` (opacity) | `userColor` | `chrome.bg` | `chrome.fg` | `chrome.text` | `chrome.tile` / `chrome.tileFg` | `chrome.panel` | `chrome.accent` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `standard` | Google default: pale grey land, light blue water, white and yellow roads | `#1a56c4` (0.9) | `#ffffff` | `#1c1c1e` / `#ffffff` (0.8) | `#c62828` | `#ffffff` | `#5f6368` | `#202124` | `#e8f0fe` / `#1a56c4` | `#ffffffe6` | `#1a56c4` |
| `expedition` | Retro: sand `#ebe3cd`, teal water, brown labels | `#b3401a` (0.9) | `#fff8e6` | `#3b2f1b` / `#fff8e6` (0.85) | `#1f5e3a` | `#f5f1e6` | `#6b5e3f` | `#2c2416` | `#e2d5b0` / `#2c2416` | `#f5f1e6e6` | `#8a4a1a` |
| `blizzard` | Silver: `#f5f5f5` land, `#c9c9c9` water, grey labels | `#0060b8` (0.9) | `#ffffff` | `#2b2b2b` / `#ffffff` (0.8) | `#b0164a` | `#f7f7f7` | `#5c5c5c` | `#1f1f1f` | `#dfe6ee` / `#1f3a5f` | `#f7f7f7e6` | `#0060b8` |
| `charcoal` | Dark: `#212121` land, black water, `#757575` labels | `#ffb300` (0.9) | `#ffffff` | `#000000` / `#ffffff` (0.8) | `#4fc3f7` | `#2a2a2a` | `#a0a0a0` | `#f0f0f0` | `#3a3a3a` / `#ffffff` | `#1c1c1ce6` | `#ffb300` |
| `night` | Night: `#242f3e` land, `#17263c` water, gold `#d59563` labels | `#33d6ff` (0.85) | `#ffffff` | `#0b1220` / `#ffffff` (0.8) | `#ffb74d` | `#0f1a2b` | `#8fa3c2` | `#f2f6ff` | `#1e2b40` / `#f2f6ff` | `#0b1220e6` | `#33d6ff` |
| `nebula` | Aubergine: `#1d2c4d` land, `#0e1626` water, `#8ec3b9` labels | `#ffd166` (0.9) | `#ffffff` | `#0e1626` / `#ffffff` (0.8) | `#ff7eb6` | `#1d2c4d` | `#98a5be` | `#f0f4ff` | `#2a3d63` / `#f0f4ff` | `#141f36e6` | `#ffd166` |

The thumbnails show the map, not the chrome. The contrast rule (`chrome.text` on `chrome.bg` and `chrome.tileFg` on `chrome.tile` at 4.5:1 or better, WCAG relative luminance with alpha composited) is checked by the API at write and shown live in the panel's editor; the site tests nothing about a theme's colours.

### 8.5 Flight history overlay

**Flight history.** Input: `snapshot.event.flightHistory.points` (`{ lat, lng, recordedAt }[]`, route order, already thinned by the API; contracts 1.3). It is a previous flight drawn as the projected route, the legacy tracker's "history" toggle; it is not where Santa has been tonight. Two toggles from the menu, `flightHistory` (initial state `data.flightHistoryDefault`, off by default) and `timeLabels` (on by default); both absent when `flightHistory` is null. The viewer's choice is kept for the page load (`sections/Map/trackerToggles.ts`, never persisted; the same store keeps `flightDock`, the flight gauge shown or hidden, first shown, and `cookieTally`, the cookie tally open or collapsed, first open, 7.6), so a remount of the section (a live flip) keeps it and off stays off; the content default applies only until the viewer has toggled. The button's `aria-pressed` and its accent underline always match the overlay (`data-flight-history` on the map root). The menu's toggles take the accent colour on hover only under a pointer that hovers (`@media (hover: hover)`), so a tap on a touch screen leaves no coloured button behind. On Google the overlay is drawn as follows; on MapLibre the same module draws it as one GeoJSON source with a line layer, an arrow symbol layer, and a time label symbol layer under the same step and interval tables (8.10).

- **Line**: one geodesic `Polyline`, `strokeWeight 2`, `strokeColor theme.overlay.routeColor`, `strokeOpacity theme.overlay.routeOpacity`.
- **Arrows**: a second `Polyline` with `strokeOpacity 0` and `icons[]` of `FORWARD_CLOSED_ARROW` symbols placed every `step` points, where `step` is 20 at zoom 15 and above, 40 at 13 to 14, 80 at 11 to 12, 150 at 9 to 10, 250 below; symbol scale 3 at zoom 9 and above, else 2.
- **Time labels**: markers with an SVG data-URI icon (rounded box, label text, a dot in `routeColor`), one label each time the elapsed time from the first point with a non-null `recordedAt` crosses the next interval; interval 5 minutes above zoom 12, else 20 minutes. Label text `35 min`, `1 hr`, `1 hr 20 min`. Points with `recordedAt` null are skipped for labels; no labels when no point has a time. Below the name zoom (`NAME_MIN_ZOOM`, 12, exported from `viewpointsOverlay.ts`; `timeLabelsCollapsedForZoom(zoom)` is true below it) a time label collapses: its marker is a dot alone (`timeDotSvgDataUri(theme)`, a 12 px circle in `routeColor` with the label's stroke, anchored at its centre), `clickable: true`, with `title` the label text, so a desktop hover shows the time as the browser's native tooltip. A click on the dot (a tap on a touch screen) swaps its icon to the full label for 2.5 s (`TIME_LABEL_PEEK_MS`) and then back; each marker has one timer, a second click restarts it, and every timer is cleared with the markers. At or above zoom 12 the label markers are the full labels, `clickable: false`, as described above.
- Redraw on zoom, theme change, toggle change, and when a new snapshot carries a different `flightHistory.routeId`. All previous overlays are removed first. `fitHistory()` is offered as a menu action when the overlay is on.

**Viewpoints** (`src/map/viewpointsOverlay.ts`). Viewpoints are good spots to watch Santa fly over. The code and these docs call them viewpoints, while the contract keys keep their names: `settings.landmarks`, `controls.landmarks`, the `Landmark` schema type, and the `landmarks` toggle key. Input: the site settings' `landmarks` (`content.settings.landmarks`, read through the route map's `resolveViewpoints`, so an entry without a name or numeric coordinates is dropped), the same list the route map draws (8.9). The controller's `setViewpoints(list)` builds one Google Maps `OverlayView` per viewpoint on the overlay mouse target pane (on MapLibre an HTML `Marker` per viewpoint holding the same element); the overlay rebuilds whenever the snapshot's viewpoints change. Each element is a 28 px round badge on the glass recipe centred on the point, holding the viewpoint's icon at 18 px through the `Icon` primitive when it has one that resolves, else an 8 px dot in `--accent`, with the name beside it in the map's label style (0.75rem sans in `--text-bright` with a halo in the chrome's `--panel`). The badge is a button labelled "About <name>"; a click opens the route map's popover anchored above the badge: the name, the description when there is one, a Close button, and the "Get directions" link (`directionsHref`, the Google Maps directions URL for the point, Apple Maps on an Apple touch device, opening in a new tab). One popover is open at a time; a click on its badge, its Close button, Escape, or a press anywhere outside it and the open badge closes it. The popover does not live in Google's pane: everything in the map paints inside Google's `.gm-style` root (`position: absolute; z-index: 0; overflow: hidden`, transformed panes), a stacking context at level 0 under the corner stacks, which also clips at the map's edges. `createViewpointsOverlay` takes a popover host, and the controller passes the canvas node's parent (`container.parentElement ?? container`, the `.mapView` wrapper, whose box is the canvas's box, so the map's container pixels are host pixels). The open popover is appended to the host with `position: absolute`, `z-index: 3`, and `transform: translate(-50%, -100%)`; its `left` and `top` are the point's `fromLatLngToContainerPixel` with `top` 22 px higher (the gap above the badge), and the overlay's `draw`, which Google calls on every pan and zoom, places it again. The horizontal position is clamped so the popover stays 8 px inside the host's width (skipped while the host or the popover measures no width). In the stacking order of 7.6 it is above every pill, the gauges, the cookie tally, and the sponsor tile, and below the unavailable panel and the tracker menu. The viewpoints are on the map only at zoom 10 and above (labels crowd an overview) and while the `landmarks` toggle is on. Below the name zoom (`NAME_MIN_ZOOM`, 12) the names hide too: `update({ visible, zoom })` sets `data-name="hidden"` on every viewpoint element below it and `data-name="shown"` at or above it, on every call, and the stylesheet hides the name label while hidden. The badges stay. Under `@media (hover: hover)` a hidden name shows as a tooltip above the badge (the glass recipe, small sans text) while the badge is hovered or focus-visible. A click on the badge opens the popover at any zoom. The toggle is on by default, its button in the tracker menu's footer (7.6), and its choice is kept for the page load in `trackerToggles.ts` like the others; `controller.setToggles` carries it as `landmarks`. `data.controls.landmarks` false removes only the button. Each viewpoint's element carries `data-map-overlay=""`: Google ignores gestures from it (`preventMapHitsAndGesturesFrom`), so a pinch that starts there is the page's, and the takeover's page zoom guard (7.6) cancels it. The badge carries `touch-action: none`. Reduced motion and the takeover do not change the overlay.

### 8.6 User location and distance

```ts
// src/map/userLocation.ts
export type UserLocationState = { enabled: boolean; position: google.maps.LatLngLiteral | null; error: GeolocationPositionError["code"] | null };
export function createUserLocation(map, theme, onChange: (s: UserLocationState) => void) {
  return { enable(), disable(), setTheme(theme), setSanta(pos: LatLngLiteral | null), destroy() };
}
```

- `enable()`: if `navigator.permissions?.query` exists, query `geolocation`; `denied` reports the error without calling geolocation. Otherwise `navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })`. `disable()` clears the watch and removes the marker and line.
- User marker: `SymbolPath.CIRCLE`, scale 8, `fillColor theme.overlay.userColor` (on MapLibre an HTML marker, a 16 px circle in the same colour); pulses by toggling visibility every 600 ms unless reduced motion, in which case it is static.
- Dotted line: `Polyline` from Santa to the user with `strokeOpacity 0` and a small circle symbol repeated every 10 px in `theme.overlay.routeColor`; redrawn when either end moves.
- Distance: `geometry.spherical.computeDistanceBetween(user, santa)` in metres; displayed as feet (`Math.round`) under 1609.344 m, otherwise miles to two decimals, grouped with commas.
- State is per page load. Nothing about location is persisted.

`LocationPrompt` is a `<dialog>` opened from the menu's location button. Disabled state: explains why location is asked, warns when `inAppBrowser()` is true (user agent contains `FBAN`, `FBAV`, or `Instagram`) that location may not work inside the Facebook or Instagram browser and suggests opening the page in the system browser, gives OS-specific steps (iOS, Android, desktop) for a previously blocked permission, and offers Enable and Cancel. Enabled state: offers Disable and Back. After a `PERMISSION_DENIED` error the prompt reopens on the instructions section.

### 8.7 Marker states

| State | Marker | Chip |
|---|---|---|
| `waitingForFix` | none; map at `data.defaultCenter` and `data.defaultZoom` on Google, the event box fitted on MapLibre (8.10) | "Waiting for the first fix" |
| `tracking` | The Santa pin, its tip (bottom centre) at `live.lat/lng` | none |
| `signalLost` | Same position, the same image desaturated and dimmed (`filter: grayscale(1) opacity(0.55)`) | "No update for N s" from `lastSeqChangeAt` |

The marker never interpolates or predicts; it moves when an applied object carries a new `seq`.

Viewpoints (8.5) have no states: a badge and a name at the point from zoom 10 while the toggle is on, nothing otherwise.

The marker is the legacy red pin with the Santa hat, the bundled asset `src/map/santa-pin.png` (100 x 192 with the transparent padding trimmed, the pin tip at the bottom centre, sharp to about 64 css px). `src/map/santaPin.ts` holds its URL and builds its `img` (empty `alt`, `aria-hidden`, no pointer events); the build places that module and the asset in the shared `theme` chunk. On the tracker the image is 52 css px tall (crisp at retina from the 192 px source) in a Google Maps `OverlayView` on the marker pane (an HTML `Marker` on MapLibre), translated by (-50%, -100%) so the tip sits exactly on the fix. The image is theme neutral, so a colour scheme change does not rebuild it; the signal-lost variant is a CSS filter on the same image, never a second asset.

### 8.8 Wake lock

```ts
// src/map/wakeLock.ts
let sentinel: WakeLockSentinel | null = null;
export async function acquire() {
  if (!("wakeLock" in navigator) || document.hidden) return;
  try { sentinel = await navigator.wakeLock.request("screen"); sentinel.addEventListener("release", () => { sentinel = null; }); } catch { /* denied or unsupported */ }
}
export function release() { void sentinel?.release(); sentinel = null; }
```

Acquired when the live screen mounts and on every `visibilitychange` to visible while the live screen is mounted; released on unmount. Nothing is shown to the user about it.

### 8.9 Route map (route mode)

`route_preview` (7.4) draws `event.routeMap.path` (contracts 1.3: the linked recording simplified and smoothed by the API) with the map host of 8.10 in route mode: the same component, theme style, bounds, and layer modules as the tracker, over the event's map (`snapshot.event.trackerMap`) on MapLibre, or over Google Maps when the renderer choice of 8.1 lands there (Route mode on Google below). Over it, `routeMap.timeline` (the path's predicted position every 5 minutes from liftoff, plus the last point) drives the 5 minute marks and the time labels (every 15 minutes unless the display settings below say otherwise). The view reads as a plan, never as live tracking: nothing on it moves, and a start marker stands where Santa starts. Every time this view shows is elapsed flight time from liftoff; the event's `scheduledAt` does not affect it.

**Config.** The route map's inputs come from two sources. The event's config in the snapshot, `event.routeMapConfig` (contracts 54), gives `display` (the five display values) and `controls` (the fullscreen and terrain switches); it carries no `pois`, and a config that still carries one is not read. The places come from the site settings, `settings.places` (contracts 57): the route map takes `places.routeMap.kinds` as its POI kinds, absent meaning none. The viewpoints come from the site settings, `settings.landmarks` in the snapshot's content (contracts 54), the one sitewide list the live tracker draws too; absent means none, and a config that still carries a `landmarks` key draws nothing from it. Each value resolves on its own: the config's value, else its default. The defaults are a time label every 15 minutes, arrows on, `medium` arrows, `normal` route width, `medium` labels, both controls on, no viewpoints, and no POI kinds. A null or absent config, block, or key reads as absent, so a null config renders the default map. A viewpoint without a string `name` and numeric `lat` and `lng` is left out, and an `icon` that is not a `library` or `media` reference counts as no icon. The section data carries only `heading`, `style`, `disclaimer`, and `emptyText`, and the site settings carry no route map block. `src/content/sections/RoutePreview/routeMapConfig.ts` holds the resolution (`resolveRouteMapConfig` for the config, `resolveViewpoints` for the settings' list, `resolvePlaces` for the settings' `places`: each of `tracker` and `routeMap` is its `kinds` list kept to strings when the part is an object whose `kinds` is a list, else absent).

**Loading.** `RoutePreview` decides first, from what it already has, whether a map can render (a route map with two or more points); only then does it mount a frame and `React.lazy`-import the host (`src/mapHost/MapHost.tsx`, the `tracker-maplibre` chunk, which alone imports the `routemap` chunk holding `maplibre-gl` and `pmtiles`; section 18), so a section that falls back never loads either. Before the host mounts, `pickRenderer` (8.1) runs and the route page's `map_renderer` event is sent; the host then fetches the resolved theme's style body (8.4) in parallel with the chunk. The host sets MapLibre's worker URL to its own bundled worker (`maplibre-gl-worker-*.js`, emitted by Vite), registers the `pmtiles://` protocol once, and builds the style as 8.10 describes: the theme's `basemap` source reads `pmtiles://<trackerMap.tilesUrl>` and its `terrain` source `pmtiles://<trackerMap.terrainUrl>`, the map row's `minZoom` and `maxZoom` bound the map's zoom (the archive header is no longer read for it), `glyphs` is the CDN glyph template (the basemap layers use Noto Sans Regular, Medium, and Italic), and `sprite` is the theme's `spriteUrl` or absent (the seeded themes carry none, so their one-way arrows and road shields are left out and the place labels keep their text without the town dot). Tiles, glyphs, sprites, and style bodies are all on the CDN origin, which the CSP's `connect-src` already names (21.1).

**Map.** The path is a GeoJSON line layer in the theme's `overlay.routeColor` and `routeOpacity` with round joins and caps, over every layer of the theme; the last point is a small circle marker (`route-ends`, filled in the text colour and ringed in the chrome background) and the first carries the start marker (Start marker below). No start circle is drawn: the marker stands there. The camera fits the path's bounds with 40 px padding (less on a very small frame) when the map is created and again whenever the frame resizes (a `ResizeObserver` on the host; `trackResize` is off). The event box is the pan limit (`maxBounds`) and sets the minimum zoom to the zoom that fits it (8.2); the path's bounds are clamped to the box only when the path leaves it, so the fitted view is exactly what it was before the box existed. The map takes gestures directly, in the card and in fullscreen alike: `cooperativeGestures` is not set, so the scroll wheel zooms the map with no modifier key and one finger pans it on touch (two fingers pinch zoom); rotation, pitch, and box zoom are off. The attribution control is always expanded and reads "© OpenStreetMap contributors" (linked to the OSM copyright page), on the site's panel and text tokens. MapLibre's own stylesheet is not loaded (its weight is icons for controls the route map does not show); `src/mapHost/maplibre.css` carries the canvas, control corner, attribution, and marker rules the host uses. The map is removed on unmount; a new snapshot with the same path neither refits nor rebuilds, a changed path updates the line in place and refits.

**Light and dark.** Route mode has no theme picker and no chrome rebinding: the style is the event's enabled MapLibre theme carrying the default flag for the page's appearance (`defaultDarkMode` when `<html data-theme>` is `dark`, else `defaultLightMode`; the first enabled MapLibre theme when none carries the flag), re-resolved on every scheme change through `subscribeScheme` (7.7), so light, dark, and system all apply live; the viewer's stored tracker theme plays no part here, and the site's own tokens dress the frame, the controls, and the popovers as before. The two seeded MapLibre themes, `route-light` (default light) and `route-dark` (default dark), are the route map's former light and dark styles, generated once from the retired style builder with the vector source renamed `basemap` and the places layer present and marked (8.10), so the route preview renders the same style JSON it rendered before: light follows `standard` (Google's default roadmap: pale grey land `#f8f9fa`, `#aadaff` water, green parks, white roads with grey casings, yellow highways, and the labels in `standard`'s chrome text colours), dark follows `night` (`#242f3e` ground, `#17263c` water, `#263c3f` parks and woods, `#38414e` roads with `#212a37` casings, `#746855` highways, gold `#d59563` place labels, `#9ca5b3` road labels); their overlay palettes are the route map's former path and label colours and their chrome the chrome of the Google theme each follows (`standard`, `night`), which is where the route palette's marker, halo, and viewpoint colours came from. A scheme change calls `setStyle` with `diff: true` on the same map; the two seeds share every source and layer id, so the diff changes paint properties only and the tiles stay on screen with no reload and no flash.

**Timeline.** The timeline entries with numeric `minutes`, `lat`, and `lng` are used, in minute order; with fewer than two of them the path, its end circle, and the start marker are drawn exactly as above and there are no marks and no time labels. The timeline draws only the marks and the time labels: there is no slider, no time readout, and no Santa pin.
- *Marks*: a small dot at every entry, a GeoJSON circle layer (`route-marks`) above the route line and below the end markers, filled in the chrome background and ringed in the route colour at 2 to 3 px, so it stays subtle in both appearances. It shares its source and layer id across both styles, so the appearance switch stays a paint-only diff.
- *Time labels*: the host passes `routeLayers`' `timeLabels` option (see Layer options below) with one label at every interior entry whose minutes are a multiple of the time label interval (15 by default, see Display settings below; an interval of 0 passes no labels, so the style has no time label source or layers; never minute 0 and never the final entry, where the start and end markers already stand), each a dot a little larger than the marks with its elapsed time beside it in the "1h 15m" form: minutes only under an hour and hours plus minutes from one hour, with no zero padding ("15m", "45m", "1h 0m", "1h 15m"); no wall clock time appears in this view, whether or not the event has a `scheduledAt`. The 5 minute marks stay as they are. MapLibre's collision handling stays on, so where labels crowd some are dropped rather than overlapping. A new timeline rebuilds them through the same `setStyle` diff.

**Start marker.** Whenever the path has two or more points, a MapLibre `Marker` anchored `bottom` stands on `path[0]` in place of a start circle (`src/content/sections/RoutePreview/routeStartMarker.ts`). Its element is an inline SVG flag 36 css px tall in `currentColor` (`--text-bright`): a short pole on a round base, and at its top a five-point star filled `--gold` with a thin `--text-bright` stroke. Beside the star sits a label, "Starts here" (`copy.map.routeStart`), in the pill recipe (7.3) on `--panel` with a 1 px `--line` border and a small shadow, so it reads over the light and the dark basemap alike. The marker never moves and takes no pointer events. It and its label are `aria-hidden`; the map region's accessible name carries the meaning: "Santa's planned route; the star marks where he starts" (`copy.map.routeMap.region`). A changed path moves the marker to the new first point; the marker is removed with the map.

**Controls.** A control stack sits at the top right of the map frame, above the canvas and the attribution, in the icon button recipe (`src/ui/IconButton.module.css`: 44 px round touch targets on `--panel-2` with no border, the accent wash on hover and when pressed, the same in both appearances). It appears once the map has mounted and holds, top to bottom:
- *Fullscreen*, unless `routeMapConfig.controls.fullscreen` is false. Its accessible name is "Show the route map fullscreen" (`copy.map.routeMap.fullscreen`) and, while fullscreen, "Exit fullscreen" (`copy.map.routeMap.exitFullscreen`), with `aria-pressed` following the state.
- *Terrain*, unless `routeMapConfig.controls.terrain` is false, and only when the event's map carries a terrain file (`trackerMap.terrainUrl`) and the theme has a layer whose `source` is `terrain`. Its accessible name is "Terrain view" (`copy.map.routeMap.terrain`), with `aria-pressed` on while the relief is shown.

Both switches come from the event's config (`controls: { fullscreen?: boolean, terrain?: boolean }`, Config above); an absent or null `controls`, or an absent or null key in it, means true.

**Fullscreen.** The fullscreen target is the wrapper around the map frame (`route-map-stage`), so the map, its markers, the control stack, and the attribution all go fullscreen together; the heading and the disclaimer stay behind. The Fullscreen API counts as available only through the unprefixed element API: `document.fullscreenEnabled === true` and a `requestFullscreen` function on the wrapper (`fullscreenSupported` in `src/lib/fullscreen.ts`); the webkit prefixed request is only the call fallback once that check passes. iPhone Safari reports `webkitFullscreenEnabled` but takes element fullscreen only for video, so it fails the check and always gets the takeover; iPadOS and desktops keep real fullscreen. Where the API is available the button requests fullscreen on the wrapper, and the state turns on and off only on the `fullscreenchange` events (never when the request is made); a request that rejects, or that brings no `fullscreenchange` within 1 second, falls back to the takeover. The takeover renders the same wrapper through a portal to `document.body` (`TakeoverPortal`, the same React tree moved, so the map is not rebuilt and no transformed or filtered ancestor traps it), fixes it over the viewport (`position: fixed; inset: 0`, z-index 1000, the site background `--ground`, padding that respects the safe area insets), and contains overscroll; the body scroll is locked (`overflow: hidden` on `<body>`) only while the takeover is mounted under `document.body`, and released on every exit: the button, Escape, a route change, and an unmount. In both, the map frame takes the whole height. The same button exits both, Escape exits both, a route change exits both, and leaving through the browser's own fullscreen controls turns the state off too. On entering and on leaving the map resizes to its frame and refits the path (the same fit as on mount). The switch is instant: no transition runs, so there is nothing to skip under reduced motion.

**Terrain.** The terrain view is the theme's `terrain` source (`raster-dem`, `terrarium` encoding) over `pmtiles://<trackerMap.terrainUrl>` and every layer of the theme whose `source` is `terrain` (the seeds carry one `hillshade` layer, `terrain-hillshade`, directly under the basemap's `water` layer, so the relief shades the ground and landuse fills while the water, the roads, the labels, and the route draw over it). There is no known layer id: "on" means those layers are present and "off" removes them, through the same `setStyle` diff as a scheme switch, so a scheme switch keeps the state. When `trackerMap.terrainUrl` is null the layers are dropped at load and the toggle is hidden, with no probe and no request. The hillshade paint (exaggeration, shadow, highlight, and accent colours) is the theme's. The viewer's choice is kept through the site's storage helper (`src/lib/storage.ts`) under `wmsfo.routeMap.terrain` (`on` or `off`; absent means on) and restores on the next mount. So the terrain view defaults on: where the toggle is available (the switch on, a terrain file on the map, and terrain layers in the theme) a viewer with no remembered choice gets the hillshade, and a viewer who turned it off keeps it off. The tracker's own Terrain and Road pair is plain state, default terrain, not remembered (7.6): each surface keeps its own toggle.

**Layer options.** The canonical style builder (`src/routeMap/style.ts` and `flavors.ts`, with `style.test.ts` and `flavors.test.ts`) is retired: the basemap is the theme's, and the two seeds it produced live in the API contracts fixtures (`contracts/fixtures/themes/`), which are the one cross-repo fidelity check. What the site adds over a theme is `src/mapHost/routeLayers.ts`: GeoJSON sources and layers for the path, the marks, the arrows, the time labels, and the viewpoint dots, added above the theme's last layer and rebuilt through the same `setStyle` diff, with every colour from the theme's `overlay` and `chrome`. Its options are `{ arrows?: boolean; arrowScale?: number; routeWidthScale?: number; labelScale?: number; labelMinZoom?: number; timeLabels?: { lat: number; lng: number; label: string }[]; viewpoints?: { lat: number; lng: number; label: string; badge?: boolean }[] }`. `arrows` adds a line placed symbol layer (`route-arrows`) over the route line that repeats an arrowhead every 140 px, turned along the line direction and tinted in `overlay.arrowColor` through `icon-color`; the icon is the SDF image `makeRouteArrowImage()` returns, which the host adds under the exported `ROUTE_ARROW_ICON` name on MapLibre's `styleimagemissing`, so it survives every `setStyle` diff and needs no sprite. `arrowScale` (default 1; values at or under 0 read as 1) multiplies the arrow layer's `icon-size` and `symbol-spacing` by the same factor, so larger arrowheads sit further apart; nothing else reads it. `routeWidthScale` (default 1; values at or under 0 read as 1) multiplies the route line's `line-width` at each zoom stop (3 px at zoom 8 and 5 px at zoom 14 at a scale of 1); the line has no casing, so nothing else reads it. `timeLabels` adds, for each entry, a dot a little larger than the 5 minute marks (`route-time-label-dots`) and its ready made `label` beside it (`route-time-labels`): Noto Sans Medium at a full size of 20 px on the zoom curve of Label sizes below, in `overlay.timeLabelFg` with a 3 px halo in `overlay.timeLabelBg`, placed by MapLibre's collision handling so no two labels overlap. The module never formats a time. The host passes `timeLabels` (the Time labels of the Timeline above), `arrows`, `arrowScale`, `routeWidthScale`, and `labelScale` (Display settings below), and `viewpoints` from the site settings (POI kinds and viewpoints below). The admin panel's poster studio draws its own overlay from the same theme rows and maps; nothing in the site serves it.

**Display settings.** Five display values shape the site's route map: the time label interval (`timeLabelIntervalMinutes`: 0, 5, 10, 15, or 30), `arrows` (a boolean), `arrowSize` (`small`, `medium`, `large`, `xlarge`), `routeWidth` (`thin`, `normal`, `thick`, `xthick`), and `labelSize` (`small`, `medium`, `large`), the `display` block of the event's config (Config above). Each value resolves on its own: the config's value, else the default (15, true, `medium`, `normal`, `medium`); a value that is absent, null, or outside its contract set takes the default. `src/content/sections/RoutePreview/routeMapConfig.ts` holds the resolution and one table (`DISPLAY_SCALES`) turning the named sizes into the style's scales:

| Name | Scale | Name | Scale |
| --- | --- | --- | --- |
| `arrowSize: small` | 0.75 | `routeWidth: thin` | 0.75 |
| `arrowSize: medium` | 1 | `routeWidth: normal` | 1 |
| `arrowSize: large` | 1.5 | `routeWidth: thick` | 1.5 |
| `arrowSize: xlarge` | 2 | `routeWidth: xthick` | 2 |
| `labelSize: small` | 0.8 | `labelSize: large` | 1.3 |
| `labelSize: medium` | 1 | | |

The interval replaces the fixed 15 of the Time labels above (the interior multiples only rule still holds, and 0 removes the labels); `arrows` becomes `routeLayers`' `arrows`, the arrow size's scale its `arrowScale`, the route width's scale its `routeWidthScale`, and the label size's scale its `labelScale` (Label sizes below). A change of any of them rebuilds the style through the same `setStyle` diff.

**Label sizes.** The time labels and the viewpoint names, with the dots under them, grow with the zoom so they stay light over the whole route and read fully at street level. `routeLayers` multiplies each of those four sizes (the time label text, 20 px at full size; the viewpoint text, 14 px; the time label dot, 3.5 px at zoom 8 to 4.5 px at zoom 14; the viewpoint dot, 2.5 px to 3.5 px) by a zoom factor that is two thirds at zoom 12 and under, the fitted view of a valley route in the card, rises linearly to 1 at zoom 16, street level, and stays 1 above it (`LABEL_CURVE` in `routeLayers.ts`), so nothing jumps as the map zooms. Each size is one `interpolate` `linear` `zoom` expression over the zooms of the curve and of the dot's own stops. The option `labelScale` (default 1; values at or under 0 read as 1) multiplies every one of those sizes at every zoom, and the site passes the scale of the config's `labelSize` (0.8, 1, or 1.3; absent means `medium`, 1).

**Map detail.** The basemap's own label layers (places, roads, POIs) are the theme's: which of them exist, and from what zoom, is decided in the style file, not by the site. The site touches only the layers the theme marks with `"metadata": { "wmsfo:places": true }` (POI kinds and viewpoints below).

**POI kinds and viewpoints.** The section passes `settings.places.routeMap.kinds` as the place filter and `settings.landmarks` with each `name` as the `label` of `routeLayers`' `viewpoints` (Config above); without them it passes neither, and the fullscreen, terrain, and time label behaviour above is unchanged. The place filter is the host's (8.10): the kinds, mapped from the nine tracker kinds of `poiStyles.ts` to Protomaps `kind` values, become a filter on every layer the theme marks `wmsfo:places`; an absent or empty list hides those layers, so the route map shows no places unless the settings name some, and a theme with no marked layer shows none whatever the list. `viewpoints` adds, for each entry, a dot (`route-landmark-dots`, 2.5 to 3.5 px at full size in the chrome's `fg`, ringed 1 px in the chrome's `bg`) and its `label` beside it (`route-landmarks`, Noto Sans Medium at a full size of 14 px, smaller than the 20 px time labels at every zoom, both on the zoom curve of Label sizes above, in the same `timeLabelFg` on `timeLabelBg` pair with the same 3 px halo), both over the end markers and under the time label layers, drawn at every zoom from the `route-landmarks` source. Collision handling stays on, so a crowded viewpoint label is dropped rather than overlapping, and a time label wins over a viewpoint.

**Viewpoint icons and descriptions.** A viewpoint may carry an `icon` (the shared `Icon` reference) and a `description` (up to 300 characters), both from the site settings (Config above). A viewpoint with neither is a plain viewpoint and is drawn exactly as above, with no marker. A viewpoint whose icon draws is passed to the style with `badge: true`: the dot layer leaves it out (a `["!", ["has", "badge"]]` filter, present only when some viewpoint has a badge) and its label sits 1.3 em out instead of 0.5 em, clear of the badge; the section stands a MapLibre `Marker` there, like the start marker, whose element holds the icon on a 28 px round badge (the panel colour, a line ring, and a shadow, readable over both basemaps) drawn by the site's `Icon` primitive (7.3): a library icon inline, a media icon through an image element with its dark version or invert rule. The badge is `aria-hidden`; the name label on the map stays beside it. An icon that does not resolve counts as no icon. A viewpoint with a description is tappable, whatever its icon state: its marker holds a button (over the badge, or a 24 px transparent target over the style's dot) whose accessible name is "About <name>" (`copy.map.routeMap.viewpoint`), with `aria-expanded` and `aria-controls`. Tapping it opens the viewpoint's popover in the map frame's top left corner, clear of the control stack: a `role="dialog"` panel in the site's panel, line, and text tokens, labelled by its heading (the name) and holding the description, with a close button ("Close", `copy.map.routeMap.closeViewpoint`, in the icon button recipe) that takes focus on open. Under the description the popover holds a "Get directions" link (`copy.map.routeMap.directions`), a plain `<a>` in the small outline button recipe (`src/ui/Button.module.css`) with `target="_blank"` and `rel="noopener"`, so it works without script once the popover is open. On an Apple touch device (an iPhone, iPad, or iPod user agent, or a Macintosh one with more than one touch point, which is how iPadOS reports itself) it points at `https://maps.apple.com/?daddr=<lat>,<lng>`, and everywhere else at `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`, with the viewpoint's own coordinates (`src/lib/directions.ts`). It is navigation, not a fetch, so the CSP needs neither host. One popover is open at a time; it closes from its close button, Escape (both return focus to the viewpoint's button), a tap anywhere outside the popover and that button, or that button again. An Escape the popover closes is marked handled, so a fullscreen map stays fullscreen; the next Escape leaves fullscreen as before. The markers are removed with the map, and a changed viewpoint list replaces them.

**Names at a distance.** The section passes `labelMinZoom={12}` to the map (`MapHost` passes it and `onViewpointClick` through to the host's options of the same names, and `labelMinZoom` is re-applied on every update). `routeLayers`' `labelMinZoom?: number` option, when set, gives the two text layers (`route-landmarks` and `route-time-labels`) that `minzoom`, so the viewpoint names and the time label text hide below zoom 12; the dot layers (`route-landmark-dots`, `route-time-label-dots`) never carry a `minzoom` and stay at every zoom. Without the option no layer gains a `minzoom`. The map handle binds MapLibre events on the two dot layers by layer id (`map.on("mouseenter", "route-landmark-dots", ...)` and the same for the time label dots), so the listeners survive every `setStyle` diff. While `map.getZoom()` is below `labelMinZoom`, a pointer entering a dot shows a `Popup` (`closeButton: false`, `closeOnClick: false`, `offset: 10`, `className: "route-map-tip"`, styled in `maplibre.css` on the glass recipe in small sans text) with the feature's `label` at the feature's point and the pointer cursor; leaving the dot removes it. A click on a time dot below that zoom (a tap on a touch screen) shows the same popup for 2.5 s. A click on a viewpoint dot, at any zoom, calls `onViewpointClick` with the feature's coordinates, and the section finds the viewpoint at that point in its list and opens its popover, so every viewpoint opens a popover: a plain viewpoint's holds the name, the close button, and the directions link, and the description paragraph appears only when there is a description. The handle stamps the map container with `data-names="hidden"` or `data-names="shown"` by the same rule, at mount and on every `zoom` event. Every viewpoint marker holds a tooltip span (`routeViewpointTip`) with the name after its badge or button, shown under `@media (hover: hover)` while the marker is hovered and the container carries `data-names="hidden"`, since a badge viewpoint has no style dot.

**Route mode on Google.** When the renderer choice lands on Google (no map on the event, no enabled MapLibre theme, no WebGL 2, or a runtime fallback) the route preview draws the same things with Google primitives through the Google controller: the path as a `Polyline` in the theme's `overlay.routeColor`, arrows as symbol icons along it, the timeline marks as small circle symbols, time labels and viewpoints as markers, the start marker flag and the end circle as markers, terrain as the `terrain` map type, and the bounds as in 8.2. The style is the event's Google theme carrying the default flag for the page's appearance, re-resolved on a scheme change like the MapLibre one. Hillshade colouring and the pattern layers of a MapLibre theme have no Google equivalent and are simply absent, the same as on the tracker. It costs one Google map load per route page view for the viewers who land there.

**Fallbacks**, in order: `event.routeMap` null or a path with fewer than two points renders the heading and `emptyText` (nothing when `emptyText` is empty), never a picture; a MapLibre failure (the chunks, the style body, the glyphs, or the tiles failing before the first complete render, MapLibre's first `idle`, or a lost WebGL context) tears the host down and rebuilds the same view on Google with a `map_renderer_fallback` event (8.1); a Google load failure then renders the heading and `emptyText`. A failure logs one `console.warn` and swaps the frame for the heading and `emptyText`, so no card is ever left blank; a tile that fails after the first complete render (a blip while panning) leaves the map up.

### 8.10 The MapLibre tracker

`src/mapHost/` is one MapLibre host for the route preview and the tracker, in the `tracker-maplibre` chunk (section 18), behind the controller interface of 8.3. It owns the map, the theme style, bounds, terrain, fullscreen, and the layer modules. Two modes, each on both renderers:

| Piece | Route mode (`route_preview`, 8.9) | Live mode (`map` section, `maplibre` renderer) |
|---|---|---|
| Style | The event's enabled MapLibre theme carrying the default flag for the page's appearance, re-resolved on every `<html data-theme>` change; no theme picker, no chrome rebinding, the site's tokens as before | The viewer's theme (8.4), never changed by a scheme change; the chrome rebinding of 8.4 |
| Path, arrows, time labels | From `event.routeMap` and `routeMapConfig.display`: the path, one mark per `timeline` entry, labels at the configured interval (`routeLayers`) | The flight history overlay of 8.5, the same module, drawn from the same config |
| Pins | Viewpoints from `settings.landmarks`, with the popover and directions link (`pins`) | The same list, the same module |
| Place filter | `settings.places.routeMap.kinds` | `settings.places.tracker.kinds` |
| Controls | Fullscreen and terrain per `routeMapConfig.controls`; the terrain toggle remembered under `wmsfo.routeMap.terrain`, on unless off | Menu, follow, recenter, zoom, location, and the Terrain and Road pair in the menu (7.6): plain state, default terrain, not remembered |
| Markers | The start marker flag and the end circle; nothing moves | Santa, user location |
| Bounds | Fit to the path; the event box as the pan limit and the minimum zoom (8.2) | The event box (8.2) |

**Live mode.** `Map.tsx` builds `maplibreController` instead of the Google controller when `pickRenderer` says `maplibre` (8.1); everything in 7.6 is unchanged, because the pills, the menu, the gauge, and the tally read the store and the controller interface, never the map. The initial view when no fix exists is `fitBounds(trackerBbox)`, not `data.defaultCenter` and `data.defaultZoom`, which the `map` section keeps only as the view inside the box when a fix exists but the box does not contain it; with a fix, centre on it at `data.defaultZoom` as on Google. The Santa marker is an HTML `Marker` holding the same pin image (8.7); the flight history overlay is one GeoJSON source with a line, an arrow symbol, and a time label symbol layer under the same tables as 8.5; the viewpoints and the user location are HTML markers (8.5, 8.6); the Terrain and Road pair in the menu calls `setMapType`, `"terrain"` putting the theme's terrain layers in and `"roadmap"` taking them out, plain state, default terrain, not remembered. Terrain and appearance stay per-surface behaviours, as the table says.

**Sources.** A MapLibre theme declares sources named `basemap` (`vector`) and, optionally, `terrain` (`raster-dem`), with no URL; the API refuses a style with one. The host (`themeStyle.ts`) injects `pmtiles://<trackerMap.tilesUrl>` into `basemap` and `pmtiles://<trackerMap.terrainUrl>` into `terrain` at load, sets `glyphs` to the CDN glyph template (`<cdn>/basemap/glyphs/{fontstack}/{range}.pbf`; the fonts do not depend on the box) and `sprite` to the theme's `spriteUrl` (absent when null), the same values the API writes into the stored body, and gives the map `maxBounds` and the fitted minimum zoom from `trackerBbox` (8.2) with the map row's `minZoom` and `maxZoom` as the tile range. Theme and map are independent: any theme renders on any map. When `trackerMap.terrainUrl` is null every layer whose `source` is `terrain` is removed before the style is set and the terrain control is hidden; the host never probes an archive. The worker is the bundled `maplibre-gl-worker-*.js` and the `pmtiles://` protocol is registered once per page, as the route map always did.

**Places.** The place filter of 8.2 applies here as a layer filter: `places.ts` maps the nine kinds of `POI_KINDS` (`poiStyles.ts`) to Protomaps `kind` values (one table) and sets `["all", <the layer's own filter, when it has one>, ["in", ["get", "kind"], ["literal", kinds]]]` on every layer whose `metadata` carries `"wmsfo:places": true` (the layer's own filter stays, so a seed's zoom rule still holds; the host remembers each marked layer's original filter and rebuilds from it on every change); a null or empty list hides those layers (`visibility: "none"`), and a theme with no marked layer shows no places whatever the list. The tracker passes `settings.places.tracker.kinds` and the route map `settings.places.routeMap.kinds` (7.6, 8.9). The Google renderer keeps `poiStyles` wrapping the theme's array, as before.

**Runtime fallback.** As 8.1: a `webglcontextlost` without `webglcontextrestored` within 5 s, a failed MapLibre chunk, or a style load failure removes the map and hands the container to the Google controller with the event's Google themes, the viewer's stored key kept when a Google theme has it and the default of 8.4 resolved otherwise; the `map_renderer_fallback` event records `surface` and `reason`. The store subscription, the toggles, and the overlays carry over, since they live behind the controller interface; the route preview rebuilds the same view in route mode on Google (8.9).

---

## 9. Leaderboard

```ts
type LeaderboardProps = { cookieTypes: Snapshot["cookieTypes"]; tally: LiveObject["cookieTally"]; variant: "panel" | "full" };

export function rankCookieTypes(cookieTypes, tally) {
  return cookieTypes
    .map(t => ({ ...t, count: tally[String(t.id)] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.sort - b.sort || a.id - b.id);
}
```

- One row per `snapshot.cookieTypes[]` entry: the type's `icon` through the `Icon` primitive with `alt=""` (a neutral placeholder when `icon` is null or unresolvable), `name`, `count`. Types with zero cookies show `0`.
- Renders nothing when `cookieTypes` is empty or `snapshot` is null.
- Counts update whenever a live object is applied; a count change animates the row order unless reduced motion.
- `variant: "panel"` (top five visible, expand for all) and `variant: "full"` wherever a `leaderboard` section asks for them, `full` on the ended page in the starter content. `data.emptyText` renders when there are no types.
- The live screen does not use the panel variant: its cookie tally is the bare `CookieTally` column of 7.6, ranked by the same `rankCookieTypes`, with no animation.

---

## 10. Cookie control

Rendered by the `cookie_control` section; the live screen opens the same dialog from its leave-a-cookie glyph (7.6). Outside `live.eventStatusId === 3` the section renders `data.closedCopy` and nothing else. Signed out: `data.signedOutCopy` and a sign-in button using the auth sign-in action with `returnTo` the current path. Signed in: a button opening the cookie dialog, a native `<dialog>` opened with `showModal` so it is centred in the viewport on every screen, the live screen included, over a dimmed backdrop; it closes on Close, on Escape, and on a tap outside it (not while a submission is running). Every control in it composes the shared button, field, and dialog recipes in `src/ui`.

Flow:

1. On open: `GET /me/cookies` once. Render how many the visitor has left for Santa so far, `limit` minus `remaining`, out of `limit` in the heading row (`copy.cookies.left`, `data-testid="cookie-remaining"`): having given all ten it reads "10 of 10 left". It used to count the unused ones, so the same visitor read "0 of 10 left", and since "left" is the past tense of this dialog's own verb that looked like none had been left at all. The number counts up as cookies are left; the picking logic still works from `remaining`, one row per `snapshot.cookieTypes` entry (icon, then the name with the running tally under it, then a stepper: fewer, count, more), and an optional note field. The tally is `live.cookieTally` for that type through `formatCount` (`data-testid="cookie-row-tally"`, in the dim mono with a visually hidden "left so far"), so a visitor sees how many of each cookie Santa has been left while choosing their own; it sits under the name rather than beside it because beside it the name lost its width and truncated on a 375 px phone. The stepper buttons are 36 px icon buttons written out in `CookieControl.module.css` rather than composed from the text-button recipe: composing it put `.btn`'s `padding: 0.4rem 1rem` after the override in the sheet, so the glyph was laid out in 36 px minus two 1 rem sides, a 4 px wide sliver, and the plus and the minus read as specks whatever size or colour they were given. The button carries its own `--line` border (the quiet fill is a few points off the panel in the dark scheme, so it did not read as a button either), sizes its glyph in CSS (`.stepBtn svg`, 20 px) so it never depends on the padding again, and draws it at a 2.5 stroke in `--text-bright`. A disabled stepper keeps full opacity and dims to `--text-dim` on a transparent fill instead of taking the shared 0.5 wash: disabled is the common state here, every plus once the visitor has none left and every minus at zero, and a dialog of 0.5 buttons read as a dialog of empty circles. The list itself is `flex: none`, so the dialog's scroll area scrolls rather than squashing it: as a shrinking flex child with `overflow: hidden` for its rounded corners it clipped its last row, cutting the last cookie in half on a short phone with no way to reach it (max 140 characters, counter shown). The visitor picks any mix of types; the more buttons disable once the picks reach `remaining`. Notes are never displayed anywhere on the site.
2. Submit ("Leave N cookies", disabled while nothing is picked, while a request is in flight, and while `remaining === 0`): one `POST /cookies { items: [ { cookieTypeId, count } ], note }` carrying the whole pick, one entry per type with a count above zero, in type order. `note` is sent as `null` when empty, and the same note goes on every cookie of the pick. One request per submit whatever the count; the site never posts cookies one at a time.
3. `201`: `remaining` is set from the response, the picks and the note clear, and a confirmation names `left`. The leaderboard changes when the next live object carries the new tally; the control does not touch the store.

| Response | Handling |
|---|---|
| `409 cookie_limit_reached` | Nothing was stored. `remaining` is set from `details.remaining` (0 when absent) and the picks clear; at 0 submit is disabled with the copy "You have left all your cookies for this year", otherwise the copy asks for a smaller pick and the visitor picks again |
| `409 no_live_event` | Close the sheet, `pollNow()`; the screen switch follows the live object |
| `404 not_found` | Nothing was stored. The picks for the types in `details.cookieTypeIds` are dropped (every pick when the list is absent), the picker refreshes from the current snapshot, and the copy asks to pick again |
| `401 unauthenticated` | Attempt a silent renew; on failure show the sign-in link |
| `429 rate_limited` | The picks are kept; submit is disabled for `details.retryAfterSeconds` seconds with a countdown, then the visitor submits again |
| `400 validation_failed` | Show the note field error from `details.fields.note` |
| Network or `5xx` | Generic retry copy; `message` from the error body is never shown |

`GET /me/cookies` runs once per open of the sheet (a live poll never refetches it); the site keeps no cookie state between opens beyond what the last response said.

**Signed out in the dialog.** The dialog can open for a visitor who is not signed in (the live screen's glyph shows to everyone). While `auth.status` is `unknown` it shows its loading state. Once `auth.status` is known and not `signedIn` it renders the dialog chrome with "Sign in to leave cookies" as a tinted notice (`.signInNotice`, `data-testid="cookie-dialog-signed-out"`) above the same cookie list the signed-in dialog shows, and two buttons: Close, and Sign in, which closes the dialog and calls the auth sign-in action with `returnTo` the current path and search, so under the takeover the auth dialog opens over the tracker (11.5). The list is one component, `CookieRows`, shared by both bodies: the icon, the name, and the running tally under it. The signed-in body passes its stepper as the row's trailing element and the signed-out body passes none, so a visitor who cannot leave cookies yet still sees what there is to leave and how many of each Santa has, and the missing steppers with the notice above them are what say they have to sign in. `GET /me/cookies` is still not called until the visitor is signed in; signed in, the dialog is the flow above.

---

## 11. Accounts

The site never shows a Cognito page. Sign-up, confirmation, sign-in, and password reset are the site's own pages, themed like everything else, and talk to the people pool through the Cognito Identity Provider API with `amazon-cognito-identity-js` (SRP, so the password never leaves the browser in clear). No hosted UI, no redirect, no callback route.

### 11.1 The Cognito wrapper

```ts
// src/auth/cognito.ts (import()ed on demand; the auth chunk)
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute, CognitoRefreshToken } from "amazon-cognito-identity-js";
const pool = new CognitoUserPool({ UserPoolId: env.COGNITO_USER_POOL_ID, ClientId: env.COGNITO_CLIENT_ID, Storage: sessionStore });
export const cognito = {
  signUp(email, password): Promise<void>,                 // pool.signUp with the email attribute; UsernameExistsException maps to "already registered"
  confirm(email, code): Promise<void>,                    // CognitoUser.confirmRegistration
  resendCode(email): Promise<void>,                       // CognitoUser.resendConfirmationCode
  signIn(email, password): Promise<Tokens>,               // authenticateUser (USER_SRP_AUTH); UserNotConfirmedException routes to /auth/confirm
  forgot(email): Promise<void>,                           // CognitoUser.forgotPassword
  reset(email, code, password): Promise<void>,            // CognitoUser.confirmPassword
  refresh(): Promise<Tokens>,                             // CognitoUser.refreshSession with the stored refresh token
  revoke(): Promise<void>,                                // RevokeToken on the refresh token, best effort
};
type Tokens = { idToken: string; accessToken: string; refreshToken: string; email: string; sub: string; idExpiresAt: number };
```

`sessionStore` is the library's storage interface over `localStorage` (through `lib/storage.ts`, guarded), so a person who signs in before the event is still signed in on event night (refresh token 30 days on `wmsfo-site`). `session.ts` holds `Tokens`, exposes `getIdToken()` (below), `current()`, `clear()`. Only the ID token is ever sent anywhere, and only to `VITE_API_BASE_URL`. The only Cognito host the site contacts is `COGNITO_IDP_URL` (section 3); it is in the CSP `connect-src`.

Error mapping (never the SDK's message): `UserNotFoundException` and `NotAuthorizedException` on sign-in both read "Wrong email or password" (no account enumeration); `UserNotConfirmedException` sends the visitor to `/auth/confirm?email=` with a line that the account needs confirming; `UsernameExistsException` on sign-up reads "That email already has an account" with a sign-in link; `CodeMismatchException` and `ExpiredCodeException` name the code; `InvalidPasswordException` shows the pool's password rule (12 characters minimum); `LimitExceededException` and `TooManyRequestsException` read "Too many attempts, wait a minute"; anything else is the generic line with a retry.

### 11.2 The pages

Five routes (section 4), every one a single centred form card on the site's shell (the frost recipe, the shared `src/ui` button and field recipes, labels in mono uppercase, errors in `--err`, a 44 px submit), each with the site name above and a line of links below (sign in, create account, forgot password, home) so a visitor never dead-ends:

| Page | Fields | On success |
|---|---|---|
| `/auth/sign-up` | email, password, confirm password (client checks: valid address shape, 12 characters minimum, both passwords equal) | `cognito.signUp`, then navigate to `/auth/confirm?email=<email>&returnTo=` with the line "We emailed you a code" |
| `/auth/confirm` | the six-digit code (`inputmode="numeric"`, `autocomplete="one-time-code"`), a Resend link (`resendCode`, disabled 30 s after each send) | `confirm`, then `signIn` is not possible without the password, so the page shows "Account confirmed" and a Sign in button that keeps `returnTo`; when the visitor arrived here straight from sign-up in the same tab the page still holds the password in memory and signs in directly, landing on `returnTo` |
| `/auth/sign-in` | email, password, a "Keep me signed in" note (always on; the refresh token is stored regardless) | `signIn`, store tokens, `AuthProvider` becomes `signedIn`, navigate to `returnTo` |
| `/auth/forgot` | email | `forgot`, navigate to `/auth/reset?email=` with "We emailed you a code" (the same copy whether or not the account exists) |
| `/auth/reset` | code, new password, confirm | `reset`, then "Password changed" with a Sign in button |

Every form disables its submit while a request is in flight, announces errors with `aria-describedby`, trims the email and lowercases it, and never echoes the password. The pages are route-level `lazy()` in the `auth` chunk; the chunk also loads at boot when `localStorage` holds a session (a synchronous key check in `main.tsx`) so the signed-in state hydrates without a click.

### 11.3 Auth state for React

```ts
type AuthState =
  | { status: "unknown" }                             // chunk loading or hydrating
  | { status: "signedOut" }
  | { status: "signedIn"; email: string; expired: boolean };
```

`AuthProvider` reads `session.current()` at mount (loading the chunk only when a session is stored), subscribes to `session` changes (sign-in, refresh, sign-out, refresh failure), and exposes `useAuth()` with the state plus `signIn(returnTo)` (navigates to `/auth/sign-in?returnTo=`) and `signOut()`. Every public page works in `signedOut`; nothing blocks on `unknown` except the alerts page content and the cookie control, which render their signed-out variants until `signedIn` arrives. Sign-out: `cognito.revoke()` best effort, `session.clear()`, state `signedOut`, stay on the current page.

### 11.4 Bearer for API calls

```ts
export async function getIdToken(): Promise<string> {
  const s = session.current();
  if (!s) throw new SignInRequired();
  if (s.idExpiresAt - Date.now() < 60_000) { try { await cognito.refresh(); } catch { session.clear(); throw new SignInRequired(); } }
  return session.current()!.idToken;
}
```

Re-read before every call; never cached by the API client. A `401` from the API triggers one refresh and one retry, then `SignInRequired`.

### 11.5 Auth on the live screen

While the takeover is on (7.6) the five auth routes render their form card inside a centred `<dialog>` over the tracker (the same dialog recipe as the cookie control), so the person who taps Sign in in the cookie dialog signs in without leaving the map and lands back on it with the leave-a-cookie glyph ready. The tracker menu's account button (7.6) is the second way in: signed out, it closes the menu and opens the same sign-in card with the tracker as `returnTo`, and the card's links reach create an account, confirm, and reset in the same dialog; signed in, it signs out in place. Off the takeover they are ordinary pages.

---

## 12. API client

```ts
// src/api/client.ts
export type ApiError = { code: string; message: string; details: Record<string, unknown> | null; requestId: string };
export class ApiRequestError extends Error { constructor(public status: number, public body: ApiError | null, public retryAfterSeconds: number | null) { super(body?.code ?? `http_${status}`); } }
export class SignInRequired extends Error {}

export async function api<T>(path: string, opts: { method: "GET" | "POST" | "DELETE"; body?: unknown; auth: boolean; timeoutMs?: number }): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth) headers["Authorization"] = `Bearer ${await getIdToken()}`;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(`${env.API_BASE_URL}${path}`, { method: opts.method, headers, credentials: "omit",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctl.signal });
    if (res.status === 204) return undefined as T;
    const json = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
    if (!res.ok) {
      const ra = res.headers.get("Retry-After");
      throw new ApiRequestError(res.status, json, ra ? Number(ra) : (json?.details?.retryAfterSeconds ?? null));
    }
    return json as T;
  } finally { clearTimeout(t); }
}
```

Paths are bare (`/cookies`, `/me/subscriptions`), appended to `VITE_API_BASE_URL`. Clients switch on `body.code`; `body.message` is never rendered. `src/api/errors.ts` maps every code the site can meet to copy in `copy/copy.ts`; unknown codes map to a generic line. Request and response types come from `contracts/generated/openapi.ts`.

Endpoints the site calls, and nothing else:

| Call | Auth | Used by |
|---|---|---|
| `GET /me` | bearer | Alerts page (email shown as the account) |
| `GET /me/subscriptions` | bearer | Alerts page; the shell's alerts bell (7.7) |
| `GET /me/alerts` | bearer | Alerts page; the shell's alerts bell (7.7) |
| `POST /me/subscriptions` | bearer | Alerts page |
| `POST /me/subscriptions/{id}/resend-verification` | bearer | Alerts page |
| `DELETE /me/subscriptions/{id}` | bearer | Alerts page |
| `GET /me/cookies` | bearer | Cookie control |
| `POST /cookies` | bearer | Cookie control |
| `POST /subscriptions/verify` | none | `/alerts/verify` |
| `POST /subscriptions/unsubscribe` | none (JSON body form) | `/alerts/unsubscribe` |
| `POST /contact` | none | Contact page |

The site settings come from the content document in the snapshot, not from a call: among them `settings.headerLinks` (contracts 52, up to three `Link` values) feeds the header links of 7.7.

---

## 13. Alerts pages

### 13.1 The `alerts_signup` section (signed in)

On mount: `GET /me` and `GET /me/subscriptions` in parallel, once per sign-in; a live poll re-renders the page but never refetches these. Renders:

- The account email from `person.email`.
- A form: address (prefilled with the account email, editable), submit `POST /me/subscriptions { channel: "email", address }`. The site trims the address; the API lowercases it.
- The form is shown when no subscription is active (none with `verifiedAt` set and `unsubscribedAt` null); otherwise it sits behind an "Add another address" link that reveals it, so a verified person is not offered "subscribe" again.
- The list of `Subscription` rows: `address`, state (`verifiedAt` null: "Pending, check your email"; `unsubscribedAt` set: "Unsubscribed"; otherwise "Active"), `createdAt`.
- **Alerts sent to you**: `GET /me/alerts` (fetched with the other two on mount), the `AlertItem` rows newest first as a list: `sentAt` in the viewer's timezone, the event name, the subject line, the alert's `message` under it when non-null (body text at full length in `--text-dim`, one step quieter than the subject, line breaks kept through `white-space: pre-line`; nothing when null), a small kind label (`alertKindLabel` in `src/alerts/alertKind.ts`: the contract's `kind` `"event_message"` reads "update", `"event_status"` and any other kind read "status") and the address it went to when the person has more than one; "No alerts have been sent to you yet" when empty. Nothing here is a form. Actions per row: **Resend confirmation** when `verifiedAt` is null and `unsubscribedAt` is null (`POST .../resend-verification`, `202`), **Unsubscribe** when `unsubscribedAt` is null (`DELETE`, `204`), **Re-subscribe** when `unsubscribedAt` is set (`POST /me/subscriptions` with the same address, which re-activates the row).
- `data.copy` above the form (the editor's explanation of what alerts are sent).

| Response | Handling |
|---|---|
| `201` with `verifiedAt` null | Row added as Pending; copy says a confirmation email is on its way |
| `201` with `verifiedAt` set | Row added as Active (re-activation) |
| `200` (pending re-POST) | Row unchanged; copy says the confirmation was already sent, offers Resend |
| `409 address_taken` | Field error: that address is attached to a different account |
| `409 already_subscribed` | Field error: already receiving alerts at that address |
| `409 already_verified` (resend) | Refresh the list; the row is Active |
| `400 validation_failed` | Field error from `details.fields.address` |
| `429 rate_limited` | Disable the form for `retryAfterSeconds` |
| `SignInRequired` | Render the signed-out variant |

Signed out: `data.signedOutCopy` and a sign-in link with `returnTo` the current path.

### 13.2 `/alerts/verify?token=wsv_...`

On mount, read `token`; when absent or not matching `^wsv_[A-Za-z0-9_-]{43}$` render "This link is not valid". Otherwise `POST /subscriptions/verify { token }` immediately.

| Response | Renders |
|---|---|
| `200 { verifiedAt }` | "Your alerts are confirmed" (idempotent for an already verified row) |
| `404 not_found` | "This link has expired or is not valid", with a link to `/` |
| `400` or other | Same as `404` |
| Network | "Could not reach the server" with a Retry button |

### 13.3 `/alerts/unsubscribe?token=wsu_...`

Same shape with `^wsu_[A-Za-z0-9_-]{43}$`; `POST /subscriptions/unsubscribe { token }` (JSON body) on mount.

| Response | Renders |
|---|---|
| `204` | "You are unsubscribed" plus a link to `/` |
| `404 not_found` | "This link is not valid" |
| Network | Retry button |

Both landing pages post on load: one click from the email is the whole action.

---

## 14. The `contact_form` section

`data.heading` and `data.copy` above the form; `data.successText` after a `201`. Form fields and client-side limits mirror the API: `name` 1 to 100, `email` 3 to 254 and a valid address shape, `message` 1 to 2000 (counter shown). Submit is enabled only when all three pass; whitespace is trimmed before the checks.

`POST /contact { name, email, message }`.

| Response | Handling |
|---|---|
| `201` | Clear the form, show `data.successText` |
| `400 validation_failed` | Field errors from `details.fields` |
| `429 rate_limited` | Disable submit for `retryAfterSeconds`, copy says to try later |
| Network or `5xx` | Keep the entered text, show a retry line |

Below the form: a mailto link for `settings.contactEmail` when set. Social links are whatever the editor put in the page or the footer.

---

## 15. Sponsor carousel

`SponsorCarousel` (the `sponsor_carousel` section and the live screen's overlay): starts at a uniformly random sponsor when the first non-empty `snapshot.sponsors` arrives, then plays snapshot order from there (pinned sponsors first in their pinned order, then largest gift first; never shuffled), shows one sponsor at a time for its `lingerMs`, wraps around, pauses while the document is hidden. A tap on the sponsor opens a small centred `<dialog>` with the logo, the name, one 44 px icon link per address the sponsor has (the website with the library `globe` icon, Facebook with `facebook`, Instagram with `instagram`, in that order, each opening in a new tab, the label as its accessible name and title, `data-testid` `sponsor-website`, `sponsor-facebook`, `sponsor-instagram`), and a Close button; the dialog closes on Close, on Escape, and on a tap outside it. Nothing in the carousel links to a sponsors page. `data.variant` is `card` (the section: the logo with the sponsor's name centred under it, then a centred row of short bars; no linger line) or `tile` (the live screen: the legacy tracker's bare logo tile, 70 px tall and at most 180 px wide on the glass surface, the name as text when there is no logo). A snapshot change keeps the current index when the sponsor at it is unchanged, else restarts at the first; the random start applies only to the first non-empty list. Input is every sponsor in `snapshot.sponsors`; a sponsor without a logo shows its name as text. Logos render through `Media` with `sizes` fixed at the section's `logoWidth` (480 for the overlay), and in the `card` variant a filled `logoWidth` also sizes the rendered logo tile (a CSS variable on the root; 160 px from 761 px and 112 px below when the field is empty, never wider than the container; the live tile keeps the legacy 70 px height whatever the setting). Crossfade is disabled under reduced motion.

The `card` variant with two or more sponsors has controls; the `tile` variant has none. At every width the slide row is a three-column grid (`44px 1fr 44px`, gap 12 px below 761 px and 16 px from it) with a Previous and a Next icon button (the icon button recipe, chevron glyphs, labelled by `copy.sponsors.previous` and `copy.sponsors.next`) either side of the slide; there is no swipe, and a tap on the slide opens the dialog. Under the slide an `<ol>` of bar buttons (18 by 4 px in `var(--line)`, the current one 28 px in `var(--accent)` with `aria-current="true"`, each labelled by its sponsor's name) jumps to a sponsor. Left and Right on the focused slide step back and forward. Any manual step (an arrow, a bar, a key) shows that sponsor and pauses the auto-advance for 30 s, restarted by each further manual step; after it the advance resumes from the shown sponsor with its own `lingerMs`. The advance also waits while the document is hidden. The card's slide is one fixed height per breakpoint whatever the sponsor, so stepping through sponsors never moves the page: the logo box is a fixed square (160 px from 761 px, 112 px below) the image fits inside, the name is one line (24 px, ellipsis), and the slide is 192 px tall from 761 px and 144 px below; a sponsor without a logo shows its name centred in the same box. A filled `logoWidth` only picks the image size the browser fetches.

There are no fixed pages: about, sponsors, route, donate, contact, and alerts are ordinary pages in the starter content, built from the sections above, and editors change or replace them at will.


---

## 16. Analytics

```ts
// src/lib/analytics.ts
export function initAnalytics(): boolean {
  if (!env.ANALYTICS_ID || !env.ANALYTICS_ORIGINS.includes(window.location.origin)) return false;
  const s = document.createElement("script");
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(env.ANALYTICS_ID)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", env.ANALYTICS_ID, { send_page_view: false });
  return true;
}
```

Enabled only when `settings.analyticsEnabled` is true in the current bundle (checked when the first snapshot is held; a later publish that turns it off stops page views at the next navigation), both `VITE_ANALYTICS_ID` and `VITE_ANALYTICS_ORIGINS` are set, and the page origin is in the list; both are set in the Vercel Production environment only, so preview deployments, PR previews on `*.vercel.app` hosts, and local runs send nothing. The router sends one `page_view` per navigation. Beyond the page view, three events go through `sendEvent(name, params)` behind the same gate, so none of them measures anything on a preview deployment or locally; the measurement is production only:

| Event | Sent when | Params |
|---|---|---|
| `map_error` | the map fails to load or throws (8.1) | `map_error_source` (`load` or `render`), `map_error_reason` (the error's description from `describeError`, at most 160 characters) |
| `map_renderer` | once per page, when a surface picks its renderer (8.1) | `surface` (`route` or `live`), `renderer` (`maplibre` or `google`), `reason` (`ok`, `no_map`, `no_theme`, `webgl2_unavailable`) |
| `map_renderer_fallback` | a MapLibre surface falls back to Google at runtime (8.1) | `surface`, `reason` (`context_lost`, `chunk_failed`, `style_failed`) |

Nothing else is carried. No user identifier, email, or location is ever sent.

---

## 17. Reduced motion

```ts
// src/lib/motion.ts
const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
export const prefersReducedMotion = () => mq.matches;
export function useReducedMotion() { /* useSyncExternalStore on mq change */ }
```

| Surface | With reduced motion |
|---|---|
| Snow | Never rendered; the live-screen menu toggle is hidden |
| Ornaments | Rendered, but the sway keyframe is removed; they hang still |
| Marker pulse (user), signal-lost pulse | Static icons |
| Marker movement | `setPosition` is instant either way; `panTo` is replaced by `setCenter` |
| Route map | Nothing moves: the start marker stands still and there is no Santa pin, so there is nothing to reduce |
| Route map fullscreen | Instant either way: entering and leaving have no animation |
| Sponsor carousel | Rotation continues (it is content), crossfade removed; manual steps (arrows, bars, swipe, keys) change the sponsor instantly either way |
| Leaderboard reorder, funds ring fill, countdown digits | Instant |
| Menu and sheet transitions | Instant |
| Alerts bell swing | None: the bell stays still when the unread count rises |
| Messages pill shake | None: the envelope stays still when a new message arrives |

CSS also carries a global `@media (prefers-reduced-motion: reduce)` rule zeroing transition and animation durations.

---

## 18. Performance budget and code splitting

Chunks (`build.rollupOptions.output.manualChunks`):

| Chunk | Contents | Loaded when | Gzipped budget |
|---|---|---|---|
| `index` | React, router, store, shell, the page renderer, every section and block component except the map (`route_preview` adds only its choice and its `emptyText` fallback to it; MapLibre is in `routemap`) | First paint | 130 KB |
| `signalr` | `@microsoft/signalr` | After the first live object is applied (startup step 3) | 45 KB |
| `map` | `src/map/**`: the renderer choice and the WebGL 2 probe, the theme loader, the Google loader and controller; `@googlemaps/js-api-loader` | A `map` section mounts, or a `route_preview` mounts with a route map (the choice runs there too, and route mode on Google needs the controller) | 50 KB (Google's own script excluded) |
| `tracker-maplibre` | `src/mapHost/**`: the host, the MapLibre controller, bounds, terrain, fullscreen, the shared overlays and pins | A `route_preview` section mounts with a route map, or a `map` section mounts with the `maplibre` renderer (8.1) | 60 KB |
| `routemap` | `maplibre-gl` and `pmtiles` only (styles are data, so `@protomaps/basemaps` left the site) | `tracker-maplibre` loads (8.9, 8.10) | 250 KB (measured 243.5 KB brotli while the host code was still inside it; moving it out is what keeps it under) |
| `maplibre-gl-worker` | MapLibre's worker, bundled by Vite as a separate file | A MapLibre map starts | 130 KB (measured 119 KB brotli) |
| `auth` | `amazon-cognito-identity-js`, `cognito.ts`, the five auth pages | An `/auth/*` route, a sign-in click, or a stored session at boot | 60 KB |
| `alerts` | The two token landing pages | Route mounts | 15 KB |
| CSS | all | First paint | 25 KB |

Budgets are enforced in CI with `size-limit` (`package.json` `"size-limit"` entries per chunk pattern); a failed budget fails the build.

**Import rule.** `routemap` is imported only by `tracker-maplibre`; `tracker-maplibre` is imported by the route preview chunk and by the Map section chunk; `map` is imported by both of those and by nothing in `routemap`. So MapLibre is downloaded only on the `maplibre` branch and Google only on the `google` branch or after a fallback; a viewer never downloads both unless they fall back. The index chunk reaches every one of them through `import()` alone and carries none of MapLibre. `tests/unit/map/chunk.test.ts` and `tests/unit/routeMap/chunk.test.ts` encode exactly this rule against the built `dist/` (22.1).

Targets on a mid-range Android over 4G: LCP under 2.5 s on every non-live screen, map interactive under 4 s after the switch to the live screen, no long task over 200 ms on a fix.

Other rules:

- `index.html` carries `<link rel="preconnect" href="%VITE_CDN_BASE_URL%" crossorigin>` and a `modulepreload` for `index`.
- Every image goes through the `Media` primitive with `srcset` and `sizes`, so a phone downloads the 480 px variant; every `<img>` has `loading="lazy"` and `decoding="async"` except a hero background and the first carousel logo.
- Flight history redraws on zoom are debounced (150 ms); time-label markers are created once per redraw, not per point.
- The store publishes one state object per applied live object; components select fields, so a fix re-renders the data row and the live indicator and nothing else.
- No polyfills for browsers without WebSockets, `fetch`, or `AbortController`; `browserslist` is "defaults, not dead".

**iOS rendering budget.** Safari on iOS pays for compositing and paint far more than for script, so the decorative layers and the translucent surfaces follow these rules on every platform:

- A decorative canvas (snow) sizes its backing store at a device pixel ratio of at most 2 (`decorativeDpr` in `src/lib/decorativeLoop.ts`); a DPR 3 phone draws the same flakes at two thirds of the linear resolution, which is not visible at that flake size. At DPR 2 and under nothing changes.
- A decorative `requestAnimationFrame` loop runs through `startDecorativeLoop`: it paints its first frame at once, then runs only while `document.visibilityState` is not `hidden` and an `IntersectionObserver` reports the layer on screen, and resumes on the next frame when both hold again. Without `IntersectionObserver` the layer counts as on screen.
- No stylesheet or inline style uses `backdrop-filter`: translucent surfaces (the frost glass, the map glass, the icon buttons, the live screen's sponsor tile) are pre-blended fills of `--panel` at 90 to 94 percent. A sweep test fails on any `backdrop-filter` under `src/`. The card fill is a `color-mix` of the fill token and needs no filter.
- The fixed decorative layers (the ornaments layer and the snow canvas) are their own compositor layers (`transform: translateZ(0)`) with `contain: strict`, so page scroll and navigation never repaint them; the lights contain their own paint. `will-change` is not used on them.
- Touch listeners on the shell and the nav (the outside press that closes a menu) are registered `{ passive: true }`, as is the snow canvas's resize listener; none of them cancels the event.
- The frost halo (a static `filter: blur(12px)` on a pseudo-element) stays: it does not animate, and its cost on iOS is not measured. It is the first thing to replace with a pre-blended gradient if a profile shows it repainting during scroll.

---

## 19. Error and offline behaviour

| Situation | Behaviour |
|---|---|
| Live object or first snapshot never arrives | Loading page with retries forever; nothing else can render because the pages are in the snapshot |
| Unknown section or block kind in the document | Renders nothing, logged once per kind; the rest of the page renders |
| Media or icon id not in the bundle | Renders nothing (an empty box with alt text for media), logged once per id |
| Preview token rejected | "This preview link has expired"; the panel mints a new one |
| `schemaVersion !== 1` on any object | `ReloadPrompt` covers the app: one line of copy and a Reload button calling `location.reload()`; the loop stops applying objects |
| Poll failures | Store unchanged; after three consecutive failures the `updatesPaused` banner shows "Updates paused, retrying"; it clears on the next success |
| `navigator.onLine === false` | Same banner immediately |
| Hub never connects or keeps dropping | Live indicator shows "Polling" (and "Offline" once polls stop landing too); polling tightens while live; no banner |
| Snapshot fetch failing | Old snapshot keeps rendering; the page still switches on the live object; small "refreshing details" note |
| Maps script fails | "Map unavailable" panel with the reason and "Reload the page" (8.1); everything else on the live screen works |
| Geolocation error | Prompt reopens on the instructions section; distance chip hidden |
| API call fails | Inline copy per code (sections 10, 13, 14); never the server's `message` |
| Render error | Root `ErrorBoundary` renders a plain page with a Reload button; the data loop keeps running underneath |
| Unknown slug | `NotFound` |
| Site misconfigured (missing `VITE_` value) | Plain configuration error page naming the variable, before anything else runs |

Nothing retries less often than every 5 s and nothing ever gives up, matching the loop's backoff. The device clock drives every displayed duration; the site does not correct for clock skew.

---

## 20. Accessibility

- Page regions: `<header>`, `<nav aria-label="Site">`, `<main>`, and a skip link to `main`. The tracker map container is `<div role="region" aria-label="Santa tracker map">` with a visually hidden text alternative (position, speed, distance when known) updated at most every 10 s.
- Menu button: `aria-expanded`, `aria-controls`; the panel traps focus while open and closes on Escape.
- Dialogs (`LocationPrompt`, `RouteDisclaimer`, cookie sheet, the alerts and flight updates dialogs) use the native `<dialog>` element with `showModal()`, a labelled heading, and focus returned to the opener on close. Those on the shared recipe (`src/ui/Dialog.module.css`: the alerts, flight updates, and cookie dialogs) are at most 80 percent of the viewport tall (`80dvh`, with an `80vh` fallback) and never taller than the screen: the head (the title and a close X labelled by the dialog's own Close copy, `data-testid="<dialog>-close-x"`) and the action row stay put and only the content between them scrolls. They are 600 px wide on desktop; the cookie dialog composes `.dialogNarrow` and stays 440 px. Every width is capped at the viewport less 32 px. Escape and a backdrop press close them as the Close button does.
- Sponsor carousel controls: the Previous and Next arrows are icon buttons labelled by their copy, each bar is a `<button>` labelled by its sponsor's name with `aria-current` on the shown one, and the focused slide steps on Left and Right.
- Toggles are `<button aria-pressed>`; the theme picker is a `role="radiogroup"` with `role="radio"` items and arrow-key movement.
- Live regions: latest message and status-change announcements use `aria-live="polite"`; the live indicator is `role="status"`.
- Forms: visible labels, `aria-describedby` pointing at the field error, `aria-invalid` on failure, errors announced once.
- Images: content media use the reference's `alt` or the asset's; sponsor logos `alt={name}`; decorative icons and cookie type icons `alt=""` beside visible text; marker icons are `aria-hidden`. Editors see an alt field on every upload.
- Colour contrast of overlays (chips, time labels) meets 4.5:1 against each theme; each theme file carries the tested label colours.
- Touch targets at least 44 by 44 CSS pixels for map controls and menu items; every control is keyboard reachable, including zoom and recenter.
- Reduced motion per section 17.

---

## 21. Build, Vercel, CI

### 21.1 Vite

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: "hidden",
    rollupOptions: { output: { manualChunks: {
      signalr: ["@microsoft/signalr"],
      auth: ["amazon-cognito-identity-js"],
      maps: ["@googlemaps/js-api-loader"],
      routemap: ["maplibre-gl", "pmtiles"],
      "tracker-maplibre": ["src/mapHost/**"],
    } } },
  },
  server: { port: 5173, strictPort: true },
});
```

The three families (IBM Plex Sans 400, 500, 600; IBM Plex Mono 400, 500; Bricolage Grotesque 600, 700) are self-hosted in the bundle through `@fontsource` (no third-party font host), so the site loads on networks that cannot reach Google. `index.html` uses Vite's `%VITE_*%` replacement for the CSP meta and preconnect, so no environment value is written into the repository. The Cognito host is `https://cognito-idp.<region>.amazonaws.com` with the region taken from the pool id at build time (a small Vite plugin exposes it as `%COGNITO_IDP_URL%`). The map host's tiles, glyphs, sprites, and theme style bodies are all on the CDN origin, which `%VITE_CDN_BASE_URL%` already puts in `connect-src`, so no other origin is derived for them (8.10):

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://maps.googleapis.com https://www.googletagmanager.com;
  connect-src 'self' %VITE_CDN_BASE_URL% %VITE_API_BASE_URL% %VITE_HUB_URL% %COGNITO_IDP_URL%
              https://maps.googleapis.com https://www.googletagmanager.com https://*.google-analytics.com;
  img-src 'self' data: blob: %VITE_CDN_BASE_URL% https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  worker-src 'self' blob:;
  frame-src 'none'; object-src 'none'; base-uri 'self';
">
<link rel="preconnect" href="%VITE_CDN_BASE_URL%" crossorigin>
```

### 21.2 Vercel

One project. Framework preset Vite, build `npm run build`, output `dist`. Production branch `main` with `https://<site-domain>`; branch `dev` assigned the branch domain `https://<preview-site-domain>`; every other branch gets an ephemeral preview URL with the Preview environment values (those origins are not in the hub's allowed origins, so on them the hub join fails and the site runs on CDN polling alone; they are for visual review only).

Environment variables: the section 3 production set in Production; the preview set in Preview and Development.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "trailingSlash": false,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Permissions-Policy", "value": "geolocation=(self), screen-wake-lock=(self), camera=(), microphone=(), payment=()" }
    ] }
  ]
}
```

Vercel serves files that exist before applying the rewrite, so `/assets/*` and `/favicon.svg` are never rewritten; every other path returns `index.html` and the router handles it, including the `/auth/*` pages and `/alerts/verify`.

### 21.3 GitHub Actions

`ci.yml` on every push and pull request: `npm ci`, `npm run contracts:check` (fetches `contracts/` at the commit in `CONTRACTS_SHA` from the API repository and fails on any difference), `npm run contracts:types` and fail when the generated files differ from the checked-in ones, `tsc --noEmit`, `oxlint`, `vitest run`, `vite build`, `size-limit`. Deploys are Vercel's git integration; CI deploys nothing.

`e2e.yml` on `deployment_status` success for the `dev` branch (and on manual dispatch): installs Playwright, runs `tests/e2e` against `https://<preview-site-domain>` with the `dev` environment secrets (section 22.2). Playwright runs the status walk serially in one worker; page specs run in parallel after it.

---

## 22. Tests

### 22.1 Vitest

Fixtures come from the vendored `contracts/fixtures/*.json`; schema validation of fixtures is the API repository's job, the site consumes them as-is. Fake timers (`vi.useFakeTimers`) and a stubbed `performance.now`.

| Area | Cases |
|---|---|
| `applyLive.shouldReplace` | null store; different event with greater and lesser `publishedAt`; same event lower `seq`; null `seq` after non-null; equal `seq` with equal and lesser `publishedAt`; both-null `seq` with greater `publishedAt`; higher `seq` |
| `applyLive` | `lastSeqChangeAt` set on first apply and on a `seq` change only; `snapshotUrlChanged` detection; `schemaVersion: 2` sets `schemaMismatch` and stores nothing |
| `fetchers` | `credentials: "omit"`; no query string; non-2xx throws; abort on timeout; `schemaVersion` check on the snapshot |
| `flightHistory` overlay | absent when `snapshot.event.flightHistory` is null; initial state from `data.flightHistoryDefault`; redraw on a changed `routeId`; label skipping on null `recordedAt` |
| `tokens.contrast.test` | every text token on every surface token in both palettes at or above 4.5:1; `--ok`, `--warn`, `--err` on `--panel` at or above 3:1; `--on-accent` on `--accent` at or above 4.5:1 |
| `colorScheme` | stored `light` or `dark` wins over the OS; no stored value follows the OS and its `change` events; the picker's Light and Dark store the choice; System removes the key |
| `cadence` | quiet is false outside status 3; quiet on each of the three conditions; `max(1000, base / 2)`; base when not quiet |
| `loop` | startup backoff 1, 2, 3, 5, 5; timer re-armed after completion, never overlapping; `pollIntervalMs` change takes effect next arm; hidden stops polling and visible polls immediately; `online` triggers `pollNow`; failures keep the store and increment `consecutivePollFailures`; snapshot fetch on URL change with stale-result discard |
| `hub` (fake `HubConnection`) | handlers registered before `start`; `connected` only on `joined`; `reconnecting` and `disconnected` transitions; re-join and `pollNow` on `onreconnected`; `auth_expired` re-join then `pollNow`; `service_removed` retry every 5 s; denied join waits 10 s; throttled join uses the short backoff; `onclose` restarts the start loop; a second `startHub` is a no-op |
| `selectPage` | every `eventStatusId` (1, 2, 3, 4, 5, null) to its role page; an unknown id to `reload`; `reload` beats everything; `loading` before the first object or snapshot; a preview bundle wins over the snapshot; slug lookup, role slug redirect, unknown slug |
| `liveState` | live state at 29 s and 31 s; `timeReady` |
| `HomePage` (Testing Library) | applying objects in the order 1, 2, 3, 4, 5, null switches the rendered page each time without waiting for a new snapshot; time-shaped sections blank until the matching snapshot arrives |
| `registry` | every kind in `contracts/kinds.json` has a component; each renders its `defaults` and the fixture document without throwing; an unknown kind renders nothing and logs once |
| `inline/parse` | each token; nesting; unbalanced markers as text; placeholders with and without an event; the API fixture strings round-trip |
| `primitives/Media` | `srcset` from a full variant set, a partial set, and none; `sizes` per frame width; svg and gif use `src` only; missing id |
| `SectionFrame` | each width, background kind, spacing, decoration icons, anchor id |
| `nav` | home entry, hidden pages excluded, role pages excluded, extra links appended, order |
| `Leaderboard.rankCookieTypes` | zero fill; sort by count, then `sort`, then `id`; empty types renders nothing |
| `Countdown`, `EventTimes` | countdown format and hide at zero, nothing outside status 2; each field shown only when present; `airborneFor` ticks; formatting in the viewer's timezone |
| `time`, `units` | `formatElapsed`, `formatCountdown`, `mpsToMph`, feet under a mile and miles over, heading to cardinal |
| `CookieControl` | each response row in section 10 |
| `AlertsSignup`, `VerifyPage`, `UnsubscribePage` | each response row in section 13; token regex gate; post on mount; the form hidden behind the link while a subscription is active; the sent-alerts list and its empty state |
| `SponsorGrid` | equal cards in one grid, name heading, logo box or name text, the bottom row's years line and icon links, the whole-card link rule |
| `OrnamentsLayer` | five ornaments with the setting on and the page not live, none otherwise; token classes; the sway class absent under reduced motion |
| `renderer` | `pickRenderer` on each combination of map, enabled MapLibre theme, and probe answer; the probe caches its answer for the page; one `map_renderer` event per page with `surface`, `renderer`, and `reason` |
| `themes` | the loader over `snapshot.trackerThemes`: the enabled list in snapshot order per renderer; `resolveInitialTheme` resolves the stored key when enabled on the active renderer, then the default flag for the appearance, then the first enabled; `getStyle` fetches `styleUrl` once and caches; the thumbnail resolves through the media map; no colour rule is tested here (the contrast rule is the API's, 8.4) |
| `mapController`, `maplibreController` (Google and MapLibre mocked) | every interface method on both implementations; `setTheme` awaits the body; `setMapType` puts the terrain layers in and out by `source`; bounds: `restriction` and `maxBounds` from the box, the fitted minimum zoom never below 5, `recenter` and `fitHistory` clamped; the place filter on the `wmsfo:places` layers, hidden on an empty list; the runtime fallback rebuilds on Google keeping the stored key |
| `QrPage` | the beacon is sent once with the tag and referrer; page, home, and forward resolutions; an absent tag goes home; a malformed tag renders NotFound and sends nothing |
| `auth/cognito` (mocked SDK) | each wrapper call maps to the SDK method; every error name in 11.1 maps to its copy; sign-in stores tokens; `getIdToken` refreshes inside the last minute and throws `SignInRequired` when the refresh fails |
| Auth pages | client checks (address shape, 12 characters, matching passwords); submit disabled in flight; `UserNotConfirmedException` routes to confirm with the email; confirm straight from sign-up signs in and lands on `returnTo`; forgot shows the same copy for unknown addresses |
| `MapHost` in route mode (MapLibre and pmtiles mocked) | the style is the enabled MapLibre theme with the default flag for the appearance, light and dark at mount and a live switch that diffs the style on the same map; the sources carry the event's map URLs and a null `terrainUrl` drops the terrain layers and the toggle; the box is `maxBounds` and the path still fits with its padding; each fallback of 8.9 (no route map, a MapLibre failure rebuilding on Google with the event's Google theme, a Google failure) renders the heading and `emptyText` or the Google route, never an `<img>`, and logs once; with no `emptyText` the section renders nothing; the heading and disclaimer render above the map; a raw published section carrying `style: "viewer"` still mounts the map; the route line source is fed `routeMap.path`, the map fits its bounds with direct gestures (no `cooperativeGestures`), the map row's zoom range, and the OSM attribution; every config input resolves from the event's `routeMapConfig`, else its default, and a null config renders the default map; a viewpoint from `settings.landmarks` is drawn and none from a raw config that still carries `landmarks`; display, controls, viewpoints, and POI kinds in the section data, or a route map block in the site settings, change nothing; the four display values reach the layers through the scale table (an interval of 0 removes the time labels); icon viewpoints stand a badge, description viewpoints open and close their popover by every documented path, and plain viewpoints stay unchanged; the built chunks follow the import rule of section 18 (`map/chunk.test.ts`, `routeMap/chunk.test.ts`) |
| `ContactForm` | limits, trimming, each response row in section 14 |
| `PreviewPage` | fetches with the token, stores the bundle, renders the named page, shows the banner, clears on navigation, handles `404` |
| `api/client` | bearer added only when `auth`; `Retry-After` and `details.retryAfterSeconds`; `204`; `SignInRequired` when no token |
| `analytics` | disabled with an empty id, with an origin not in the list, enabled otherwise |
| `motion` | snow hidden and toggles absent under reduced motion |
| `build` sweeps | no `backdrop-filter` under `src/` (18); `no-leftover-assets`: nothing under `public/` but the favicon, the manifest, and `robots.txt` (the theme thumbnails come from the media map, 8.4) and none of the starter template's files; `csp.test.ts`: the CSP meta carries the `%VITE_*%` and `%COGNITO_IDP_URL%` placeholders and no other origin (21.1) |
| `env` | each missing or malformed variable produces the configuration error |

### 22.2 Playwright against the preview site

Configuration: `baseURL = https://<preview-site-domain>`, Chromium desktop and Pixel 7 emulation, `E2E_API_BASE_URL` (the dev API), `E2E_CDN_BASE_URL`, and the secrets below from the `dev` GitHub environment. The harness refuses to run when `E2E_API_BASE_URL` does not contain `dev`, when `GET /me` for the admin token reports `isAdmin: false`, or when any event in `GET /admin/events` has `statusId` 3 at start. When `E2E_BASE_URL` is set and is not `localhost`, Playwright runs at `workers: 1` with `fullyParallel: false`: the status walk and the home state screenshots drive the same dev event and must not run at once, and the deployed site sits behind a bot checkpoint that answers `403` with a challenge page when one address opens many pages at once. The home state screenshots cover planned, scheduled, live, ended, cancelled, and postponed; the off-season home is not captured, because no admin call leaves dev without a current event.

Global setup (`tests/e2e/globalSetup.ts`, wired through the config's `globalSetup`): when `E2E_ADMIN_ID_TOKEN` is unset and the required Cognito variables are present, mints one ID token through `getAdminIdToken()` and stores it in `process.env.E2E_ADMIN_ID_TOKEN` so every worker inherits the same token. TOTP codes are single use, so each worker minting its own token inside the same 30 second step gets `ExpiredCodeException` from Cognito. When the variables are absent (a `--list` run, a unit run) it does nothing.

Secrets: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_TOTP_SECRET`, `E2E_PERSON_EMAIL`, `E2E_PERSON_PASSWORD`. Variables: `E2E_ADMIN_CLIENT_ID` (the dev admin pool client that allows `USER_PASSWORD_AUTH`, contracts 3.1) and optionally `E2E_COGNITO_REGION` (default `us-east-1`). The walk creates and enrolls its own beacon per run and revokes it in its finally; no `E2E_BEACON_KEY` is required.

Harness (`tests/e2e/harness/`):

- `adminToken.ts`: obtains an ID token for the E2E admin: `E2E_ADMIN_ID_TOKEN` when set, otherwise `InitiateAuth` (`USER_PASSWORD_AUTH`) on `E2E_ADMIN_CLIENT_ID` with the `SOFTWARE_TOKEN_MFA` challenge answered by a TOTP computed from `E2E_ADMIN_TOTP_SECRET`; minted once per process. Global setup mints it once per run so all workers share it.
- `adminApi.ts`: typed wrappers for `GET /admin/events`, `POST /admin/events` (`createEvent`), `POST /admin/events/{id}/current`, `POST /admin/events/{id}/status`, `PATCH /admin/events/{id}`, `POST /admin/events/{id}/messages`, `GET /admin/contact-messages`, `DELETE /admin/contact-messages/{id}`, `GET /admin/snapshot`, `GET /admin/beacons` (`listBeacons()`), `POST /admin/beacons` (`createBeacon()`), `POST /admin/beacons/{id}/activate` (`activateBeacon(id)`), `POST /admin/beacons/{id}/revoke` (`revokeBeacon(id)`), and `POST /beacons/enroll` (`enrollBeacon(token)`, no admin auth; the enrollment token is the credential, contracts 3.3).
- `beacon.ts`: `replay(points, ratePerSecond, beaconKey)` posting fixes over `POST /locations` with `X-Beacon-Key`, `recordedAt = now`; `heartbeat(beaconKey)` posts one `POST /beacons/heartbeat` with `X-Beacon-Key` and `{ sentAt, health: { batteryPercent: 100 } }` so `lastSeenAt` is fresh (contracts 4.2). The caller passes the key of the beacon it is acting as.
- `personSignIn.ts`: clicks the visible sign-in control (the header action on wide viewports; the panel entry, opened through the Menu button, on narrow viewports; the cookie control's own button on the live page, which renders no shell), fills the E2E person's email and password on the site's own `/auth/sign-in` page, submits, and waits for the signed-in control the same way (Sign out in the header or panel, or the cookie control's open button); a second helper `personSignUp.ts` drives sign-up and confirmation for a throwaway `+tag` address whose code the harness reads through `AdminGetUser`-free means: the dev pool's test person is pre-confirmed, so the sign-up spec asserts only the "We emailed you a code" step and then deletes the unconfirmed user with `AdminDeleteUser` through the harness's AWS credentials.
- `site.ts`: helpers reading `data-testid` attributes and, on preview builds, `window.__wmsfo.getState()` (exposed only when `VITE_ENV !== "production"`).

Dedicated walk event: year `2100`, name `E2E walk`, with `inheritRoute: true`. The walk finds it by year and name in `GET /admin/events` or creates it (`POST /admin/events` with status 1, not current); the event is kept between runs, never deleted, and always left at status 1 and not current. Locations accumulate on it; that is accepted in dev.

`statusWalk.spec.ts`, serial:

1. Record the currently current event id (if any) and the currently active beacon id (if any) from `GET /admin/beacons`. Create a fresh beacon over `POST /admin/beacons` named `e2e-walk-<Date.now()>`, take the enrollment token from the response, and exchange it over `POST /beacons/enroll` (contracts 3.3, 3.4) to obtain a beacon key the walk uses for every heartbeat and fix. `POST /admin/events/{walk}/current`.
2. Ensure status 1 (`POST .../status { statusId: 1, notify: false }`, tolerating `409 event_status_unchanged`). Open `/`. Assert the planned page (the role page's first section is present), no countdown, the event name `E2E walk` rendered through a placeholder, no map element.
3. `PATCH { scheduledAt: now + 2 h }`, status 2 with `notify: false`. Assert the countdown appears within `pollIntervalMs + 2000` ms and decreases over 3 s; the scheduled time renders in the viewer's timezone.
4. Activate the walk's beacon (`POST /admin/beacons/{id}/activate`) and send one `heartbeat(beaconKey)` so the go-live rule is satisfied (contracts 4.5 Events, `409 no_healthy_beacon`; healthy = active, not revoked, seen within the stale window). Status 3 with `notify: false`. Assert the live page's map section renders within `pollIntervalMs + 2000` ms with the waiting-for-fix chip; the live indicator reaches "Live" within 20 s (hub joined) or the test records "polling only" and continues. The flight gauge is one dial above the sponsor tile at both widths, opening on speed, its arrows stepping and wrapping; nothing spans the bottom of the map on either page (7.6).
5. Read `snapshot.event.flightHistory.points` from the CDN snapshot; `replay(points.slice(0, 60), 2)`. Turn the flight history toggle on and assert the map root reports `data-flight-history="on"` (the overlay draws onto the Maps canvas, so the root attribute is the DOM-visible signal) and that it stays on while the marker moves. Assert the marker's `data-seq` increases and the data row shows a speed within `pollIntervalMs + 2000` ms of the first fix; log the observed latency from POST to marker update.
6. Sign in as the E2E person via the site link; open the cookie control; read `remaining`; leave one cookie of the first type; assert `201`, `remaining` decreased by one, and the leaderboard count for that type increases by one within `2 * pollIntervalMs + 2000` ms.
7. `POST .../messages { body: "E2E <run id>", notify: false }`. Assert the message reaches `snapshot.event.latestMessage` within `pollIntervalMs + 2000` ms (snapshot URL change path), the `messages-pill` shows with its `messages-dot` and no dialog open, and pressing it opens the messages dialog holding the body and clears the dot.
8. Stop replay for 35 s. Assert the signal-lost chip appears after 30 s and the marker keeps its position.
9. Status 4 with `notify: false`. Assert the ended page with the leaderboard showing the count from step 6 and the sponsor grid rendering at least one logo.
10. Status 5 with `notify: false`. Assert the cancelled page shows the message from step 7 and no countdown.
11. Status 6 with `notify: false`. Read the role pages of the document in the store: when it holds a `postponed` page, assert `main[data-page-role="postponed"]` renders with its heading; otherwise assert the `planned` fallback page renders with its heading (5.4). No countdown.
12. Restore: status 1 on the walk event (kept for the next run); `POST /admin/events/{previous}/current` when a previous current event existed; `POST /admin/beacons/{previous}/activate` when a previously active beacon existed and was not the walk beacon; `POST /admin/beacons/{walk-beacon}/revoke` on the beacon the walk minted. Every status change the walk makes keeps `notify: false`. A failure while revoking is logged and does not fail the test.

`pages.spec.ts` (parallel): each ordinary page in the published document (read from the CDN snapshot by the harness) renders its first section; an ordinary page holding a `route_preview` shows the route map or its `emptyText` and does not load the map chunk; the auth pages render at their five paths with the site's shell and no Cognito host in the document; the header theme control is a menu (`theme-toggle` opens `theme-menu` holding the `theme-light`, `theme-dark`, `theme-system` radio items): opening it and clicking `theme-dark` sets `data-theme="dark"` on `<html>`, the choice survives a reload, and opening it again and clicking `theme-light` sets `data-theme="light"`; screenshots of every page and every home state in both schemes are compared against checked-in baselines (the route page's baseline shows whichever event is current on dev at capture time, so the intended event is made current before a capture and kept current until the comparison); `/preview?token=<minted by the harness through POST /admin/content/preview-token>&page=ended` starts a preview session and lands on `/` with the preview banner, and Exit preview removes the banner; `/alerts/verify?token=wsv_<43 invalid chars>` and `/alerts/unsubscribe?token=wsu_<43 invalid chars>` render the invalid copy after one POST; `/alerts` signed in subscribes a unique address, asserts a Pending row, resends once, then deletes it; the contact form posts a message tagged with the run id and the harness finds and deletes it through the admin endpoints; the 404 page for `/nope`; reduced-motion emulation hides the snow toggle; at 320, 375, and 390 px wide `/` and every ordinary page has a `document.documentElement.scrollWidth` no wider than the viewport; at 800, 1024, and 1280 px the header nav's items sit on one line inside the nav, and when More shows it opens its menu and Escape closes it with focus back on More; the CSP meta is present and the hub WebSocket to `<gateway-domain>` opens (network log).

The manual pre-event rehearsal repeats the walk with Red-Nose's replay mode on the real phone in place of `beacon.ts`.

---

## 23. Cut-over

Site-specific steps within the overall cut-over:

1. Create the Vercel project, set the Preview environment to the dev set, push `dev`, run `e2e.yml`, and complete a full status walk against the dev stack.
2. Set the Production environment to the prod set (including `VITE_ANALYTICS_ID` and `VITE_ANALYTICS_ORIGINS`), assign `<site-domain>`, and confirm the domain is in the prod hub `realtimeAllowedOrigins`, the `wmsfo-site` client's callback and sign-out URLs, and the Maps key's referrers.
3. Merge to `main` only after the API cut-over steps have produced `live/location.json` and a snapshot on the prod CDN.
4. Path redirects for links that exist in the wild from the previous site, handled by the router with `<Navigate replace>`: `/santa` to `/`, `/funding` to `/donate`. Every other previous path is a page slug in the starter content (`about`, `sponsors`, `route`, `contact`, `donate`, `alerts`), and editors keep those slugs when they replace the copy.
5. The previous site's per-environment image URLs, route image, copy, and analytics inclusion are not carried; every page, image, and string is content in the panel, the route page renders the event's route map, and analytics follows section 16 plus the site setting.

---

## 24. Decisions made here

- Analytics fires only when `VITE_ANALYTICS_ID` is set and the page origin is in `VITE_ANALYTICS_ORIGINS`; both are set on the Vercel production environment only.

- The Playwright harness obtains its admin ID token with `InitiateAuth` (`USER_PASSWORD_AUTH`) on the dev pool's `wmsfo-admin` client and answers the `SOFTWARE_TOKEN_MFA` challenge with a TOTP computed from a CI secret; a dedicated test admin user exists in the dev pool only.

- While `eventStatusId` is 3 every path renders the live page except the four site-coded paths (`/auth/callback`, `/alerts/verify`, `/alerts/unsubscribe`, `/preview`); the other pages come back when the status changes. The live page renders its `map` section alone, fixed to the viewport, with no shell and no scrolling: the tracker is the whole site during the event, as the legacy tracker was, and its menu is the only menu.
- The live screen keeps the legacy tracker's geometry (small pills top-left, the menu card top-right, the logo tile bottom-left, zoom or recenter bottom-right) on the site's tokens and glass surface; the sponsor tile opens a dialog rather than leaving the tracker; nothing on the live screen links to a sponsors page.

- `/` is the status-driven role page; `/santa` and `/funding` redirect to `/` and `/donate`; every other path is a page slug from the document.
- One Vercel project with `main` as Production and `dev` as the Preview branch domain, rather than two projects.
- The store is a framework-free module bound to React with `useSyncExternalStore`; the map subscribes to it directly and never re-renders through React on a fix.
- `Diagnostics` (`online`, `lastPollOkAt`, `consecutivePollFailures`, fetch-failing flags) sits beside the contract `Store`; the "updates paused" banner shows when offline or after three consecutive poll failures.
- A rejected hub join whose error text matches `/throttl|budget|rate/i` uses the 1, 2, 3, 5 s backoff; any other rejection waits 10 s first.
- The SignalR client is imported after the first live object is applied; the map module is imported when the live screen or route page mounts; the auth chunk loads on the callback route, on a sign-in click, or when a stored session key exists at boot.
- Classic `google.maps.Marker` and `Polyline` with in-repo JSON style arrays, no `mapId`; six themes in the registry, the `map` section chooses which to offer and the default; the chosen key persists in `localStorage["wmsfo.tracker.theme"]`.
- The map's default center and zoom are `map` section data; the initial view centres on the fix when one exists.
- The live map shows Santa's current position only. The flight history toggle draws the previous flight embedded in the snapshot as the projected route (off by default, admin-settable); arrow step and label interval tables as in section 8.5; history and time labels are separate toggles. The map style picker stays, independent of the site's light and dark schemes.
- The route the public sees is the event's route map; `route_preview` draws it over the self-hosted basemap and never shows a picture. Nothing on the site fetches the route JSON; the tracker's flight history comes embedded in the snapshot.
- User location uses `watchPosition`, is never persisted, and shows distance in feet under one mile and miles otherwise.
- Wake lock is acquired only on the live screen and re-acquired on visibility.
- Snow follows `settings.theme.snowDefault` on every page except the live screen, where it is off by default, and is absent under reduced motion.
- Countdown hides once `now >= scheduledAt`; the scheduled time stays and nothing implies liftoff. All scheduled and end times display in the viewer's timezone.
- The live indicator shows "Updated N s ago" from `publishedAt` on the device clock; no clock-skew correction anywhere.
- Every sponsor in the snapshot appears wherever a sponsor section is placed; sponsors that may not advertise are not in the snapshot at all.
- The carousel plays snapshot order (pinned first, then largest gift first) and honours `lingerMs`; nothing on the site re-sorts sponsors; `sponsor_grid` is the static alternative. There are no sponsor tiers.
- No screen components: pages are documents, kinds are components, `registry.ts` is the only wiring point, and an unknown kind renders nothing.
- The inline grammar is parsed in the site (mirroring the API's parser) into React elements; there is no `innerHTML` anywhere.
- Every image renders through one `Media` primitive with `srcset` from the variants; every icon through one `Icon` primitive: library ids inline as generated SVG components, media ids as `<img>`.
- One visual direction (North Pole Night) in a dark and a light rendering; the visitor picks light, dark, or system, stored in the browser, stamped before first paint; the site settings carry only the snow and lights defaults. Tokens live in one file with a contrast test; components are typed CSS modules with no UI library; fonts are self-hosted.
- Preview is a route that swaps the content bundle in the store and leaves the live data alone.
- Cookie control state is whatever the last `GET /me/cookies` or `POST /cookies` response said; the tally is never bumped locally.
- Both alert landing pages POST on load after a token regex check.
- Accounts are the site's own pages over the Cognito API with `amazon-cognito-identity-js` (SRP); tokens live in `localStorage`, renewal uses the refresh token, sign-out revokes it and stays on the page; the hosted UI is never shown and there is no callback route.
- API `message` text is never rendered; every code maps to copy in `copy/copy.ts`.
- Analytics is GA4 through gtag, gated by `VITE_ANALYTICS_ID` and an exact-origin list in `VITE_ANALYTICS_ORIGINS`, page views only.
- CSP is a build-time `<meta>` in `index.html` from `VITE_` values; `vercel.json` carries only environment-free headers.
- No service worker and no PWA install prompt.
- No links, copy, or images are constants in the repository beyond the loading, error, and sign-in strings in `copy/copy.ts`.
- Playwright drives fixes over `POST /locations` with a dedicated dev beacon key in CI; the phone's replay mode is used in the manual rehearsal. A fixed dev event, year 2100, is the walk target and keeps its locations.
- Contact form limits follow the API (name 100, email 254, message 2000).
- Bundle budgets enforced with `size-limit`: 130 KB index, 45 KB signalr, 50 KB map, 60 KB auth, 15 KB alerts, 40 KB CSS, gzipped.
- Sponsor cards are equal cards in one responsive grid, the legacy layout in the site's style; nothing on a card hints at a gift's size.
- Background ornaments are a fixed layer of five inline SVGs behind every page but the live screen, coloured by tokens, swaying unless reduced motion asks otherwise, switched by `settings.theme.ornaments`.
- The map overlay palettes are chosen per theme for contrast; the Google style arrays stay the legacy tracker's.
- The alerts page hides the form while a subscription is active and lists the alerts actually sent to the person.
- Printed codes resolve from the snapshot alone; the site's only call for them is the scan beacon.

## 25. Needs a decision

Nothing at the moment. Add here as it comes up.
