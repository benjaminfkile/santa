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
| Auth | `oidc-client-ts` against the Cognito hosted UI, authorization code with PKCE, dynamic import |
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
      Shell.tsx                   nav menu, sign-in link, banners
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
      userManager.ts              oidc-client-ts UserManager factory (lazy)
      AuthProvider.tsx            auth state for React
      AuthCallback.tsx            /auth/callback page
      signOut.ts
    api/
      client.ts                   fetch wrapper: bearer, error shape, timeouts
      errors.ts                   ApiRequestError, code to copy mapping
      cookies.ts                  GET /me/cookies, POST /cookies
      subscriptions.ts            /me/subscriptions family, verify, unsubscribe
      contact.ts                  POST /contact
    content/
      registry.ts                 kind to component map (sections) and block kind to component map; the only wiring point
      PageRenderer.tsx            page = section stack; SectionFrame applies presentation
      SectionFrame.tsx            width, align, background (token or media), spacing, decoration icons, anchor
      selectPage.ts               role or slug to ContentPage (pure)
      nav.ts                      nav entries from pages and settings (pure)
      inline/                     parse.ts (the inline grammar), Inline.tsx (React renderer), placeholders.ts
      blocks/                     Heading, Paragraph, List, Quote, Media, Links, Icon, Divider
      primitives/                 Icon.tsx (library or media, <img>), Media.tsx (srcset), LinkView.tsx, resolve.ts
      sections/
        RichText/  Hero/  MediaGallery/  Links/  IconRow/  Divider/
        FundsRing/  Countdown/  EventTimes/  LatestMessage/  Leaderboard/
        SponsorCarousel/  SponsorGrid/  RoutePreview/  CookieControl/  AlertsSignup/  ContactForm/
        Map/                      Map.tsx (the live screen: full-viewport map plus overlays), TrackerMenu.tsx, InfoOverlays.tsx,
                                  LiveIndicator.tsx, LiftoffTimer.tsx, DistanceChip.tsx, MapControls.tsx, RouteDisclaimer.tsx, LocationPrompt.tsx
        Unknown.tsx               renders nothing, logs once per kind
      theme/                      tokens.css (the only file with a colour literal), colorScheme.ts (light/dark/system), tokens.contrast.test.ts
    pages/
      HomePage.tsx                the role page for live.eventStatusId
      SlugPage.tsx                the none page for /:slug, or NotFound
      PreviewPage.tsx             /preview: fetches the bundle, renders the named page
      Loading.tsx  ReloadPrompt.tsx  NotFound.tsx
      Alerts/                     VerifyPage.tsx, UnsubscribePage.tsx (token landing pages)
    components/
      Snow/
      Banner/                     UpdatesPaused, Offline, Preview
      Dialog/                     <dialog> wrapper with focus handling

    map/                          imported only by sections/Map and sections/RoutePreview (style map)
      loadMaps.ts                 Loader singleton, importLibrary("maps" | "marker" | "geometry")
      MapView.tsx                 React host for the map element
      mapController.ts            imperative controller: follow, recenter, zoom, mapType, theme
      santaMarker.ts
      flightHistoryOverlay.ts     polyline, arrows, time labels (the previous flight from the snapshot)
      userLocation.ts             watchPosition, user marker, dotted line, distance
      themes/                     index.ts plus one file per theme
      wakeLock.ts
    copy/
      copy.ts                     the few site-coded strings (loading, errors, sign-in hint, not found); everything else is content
      assets/                     marker artwork, the signal-lost variant
    lib/
      time.ts                     formatCountdown, formatElapsed, formatMountainTime
      units.ts                    mpsToMph, metresToFeet, metresToMiles, headingToCardinal
      motion.ts                   prefersReducedMotion, useReducedMotion
      inAppBrowser.ts
      storage.ts                  guarded localStorage get/set
      analytics.ts
  tests/
    unit/                         Vitest, mirrors src/
    e2e/                          Playwright: specs/, harness/, fixtures/
  .github/workflows/
    ci.yml                        typecheck, lint, unit, build, contracts check, size budget
    e2e.yml                       Playwright against the preview site after a dev deploy
```

Rules that keep the structure honest:

- Only `src/store/fetchers.ts` fetches from the CDN and only `src/api/client.ts` calls the API. Nothing else issues a network request except the Maps loader, the SignalR connection, and the analytics script.
- `src/map/**` and `@microsoft/signalr` are never imported statically from anywhere; they enter through `import()` (section 18).
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
| `VITE_COGNITO_AUTHORITY` | `https://cognito-idp.<region>.amazonaws.com/<pool-id>` (prod pool) | dev pool |
| `VITE_COGNITO_DOMAIN` | `https://<cognito-domain>` (prod pool hosted UI) | dev pool hosted UI |
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
  COGNITO_AUTHORITY: readUrl("VITE_COGNITO_AUTHORITY", "https:"),
  COGNITO_DOMAIN: readUrl("VITE_COGNITO_DOMAIN", "https:"),
  COGNITO_CLIENT_ID: read("VITE_COGNITO_CLIENT_ID", /^[a-z0-9]+$/),
  GOOGLE_MAPS_KEY: read("VITE_GOOGLE_MAPS_KEY", /^\S+$/),
  ANALYTICS_ID: readOptional("VITE_ANALYTICS_ID"),
  ANALYTICS_ORIGINS: readOptional("VITE_ANALYTICS_ORIGINS").split(",").map(s => s.trim()).filter(Boolean),
} as const;

export const LIVE_URL = `${env.CDN_BASE_URL}/live/location.json`;
export const LOCATION_CHANNEL = `${env.HUB_CHANNEL_PREFIX}:location`;
export const IS_PRODUCTION = env.ENV === "production";
```

Local development uses `.env.local` with the preview set and runs on `http://localhost:5173`, which is a registered Cognito callback origin, and a hub allowed origin for dev; the CDN answers CORS for every origin. `VITE_API_BASE_URL` is used only as the base for the writes in section 12; the site fetches `LIVE_URL` and otherwise only absolute URLs found inside CDN objects. No secrets exist in the bundle; the Maps key is referrer-restricted.

---

## 4. Routing

`BrowserRouter`; every path is served by `index.html` through the Vercel rewrite in section 21. The route table is fixed; the pages behind it are content.

| Path | Component | Chunk | Notes |
|---|---|---|---|
| `/` | `HomePage` | main (map chunk loads when the page holds a `map` section) | The page whose `role` matches `live.eventStatusId` (section 5.4) |
| `/preview` | `PreviewPage` | main | `token` and `page` from the query string (section 7.8) |
| `/alerts/verify` | `VerifyPage` | alerts | `token` from the query string |
| `/alerts/unsubscribe` | `UnsubscribePage` | alerts | `token` from the query string |
| `/auth/callback` | `AuthCallback` | auth | Registered Cognito callback path |
| `/:slug` | `SlugPage` | main | The `none` page with that slug; a role page's slug redirects to `/`; unknown renders `NotFound` |
| `*` | `NotFound` | main | Links back to `/` |

While `live.eventStatusId === 3` the router renders the `live` role page for every path; the table above applies in every other status. The only exceptions are the four site-coded paths, which must keep working during the event: `/auth/callback` completes sign-in and then navigates to `/`, `/alerts/verify` and `/alerts/unsubscribe` render their own pages because email links land there, and `/preview` renders whatever page the panel asks for.

Route-level `lazy()` with a `Suspense` fallback for the `alerts` and `auth` chunks. The shell (nav menu, banners, footer) wraps every route; on a page whose first section is `map` the shell renders only its menu button and banners over the map and no footer.

Menu entries come from `content/nav.ts`: the home entry (`settings.homeNavLabel`, `/`), then every non-hidden `none` page with a `navLabel` in `navPosition` order, then `settings.navExtraLinks`, then Sign out when signed in or Sign in when signed out. The sign-in entry is a plain link-styled button; nothing else on the site references accounts except the two sections that need one.

---


---

## 5. The store

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
        +---------------- role page for live.eventStatusId ---------------+
        |          |            |          |          |            |
   [ no_event ] [ planned ] [ scheduled ] [ live ]  [ ended ]  [ cancelled ]
      null         1            2          3          4            5
        ^          ^            ^          ^          ^            ^
        +--------- every applied live object re-evaluates the switch ---------+

   any state --- an object with schemaVersion !== 1 ---> [ reload ]   (terminal until location.reload())
```

Orthogonal indicator states, rendered as banners or chips, never as pages:

| Indicator | Condition | Where |
|---|---|---|
| `hubLive` | `hub === "connected"` and not quiet (5.5) | Live indicator on the live screen |
| `pollingOnly` | not `hubLive` | Live indicator on the live screen |
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
const ROLE_BY_STATUS: Record<number, PageRole> = { 1: "planned", 2: "scheduled", 3: "live", 4: "ended", 5: "cancelled" };

export function selectBundle(s: SiteStore): ContentBundle | null {
  if (s.preview) return s.preview;
  if (!s.snapshot) return null;
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
  const page = bundle.content.pages.find(p => p.role === role);
  return page ? { page } : "reload";                                 // a published document always has every role page
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

The old snapshot keeps rendering while a replacement is in flight. A changed `snapshotUrl` is the only way a new sponsor, message, funds percent, cookie type, or route poster reaches the browser. The route poster is an image in `snapshot.media`; the browser fetches it like any other picture, never as data.

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

All time formatting uses the device clock; scheduled times are shown in `America/Denver` with the zone abbreviation from `Intl.DateTimeFormat`. Every string a visitor reads comes from the content document, rendered through the inline grammar (7.5); the site's own copy is limited to `copy/copy.ts`.

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

### 7.3 Primitives

| Primitive | Component | Rendering |
|---|---|---|
| `Icon` | `primitives/Icon.tsx` | `source: "library"`: `<img src={bundle.icons[id]}>`; `source: "media"`: `<img src={bundle.media[id].url}>`. Always `<img>`, never inline SVG. Decorative uses pass `alt=""` and `aria-hidden`; an icon standing for something (a link icon without a label) gets the label as `alt`. Unresolvable id: renders nothing, logs once. |
| `MediaRef` | `primitives/Media.tsx` | `<img src={entry.url} srcset={...} sizes={...} width height alt loading="lazy" decoding="async">`; `srcset` lists every `variants[w]` as `{url} {w}w` plus the original as `{url} {width}w`; `sizes` from the frame width (`full`: `100vw`; `wide`: `(min-width: 1200px) 1200px, 100vw`; `narrow`: `(min-width: 720px) 720px, 100vw`), or the block's size for a media block; `alt` is `ref.alt ?? entry.alt`. `svg` and `gif` render with `src` only. Missing id: an empty box with the alt text, logged once. |
| `Link` | `primitives/LinkView.tsx` | Site paths render as router links; absolute URLs and `mailto:` as `<a>` with `rel="noopener noreferrer"` and `target="_blank"` when `newTab`; the icon before the label. |
| `Inline` | `inline/Inline.tsx` | Section 7.5. |

`primitives/resolve.ts` holds `resolveMedia(bundle, id)` and `resolveIcon(bundle, icon)`; nothing else touches the maps.

### 7.4 Section kinds

Content kinds read `data`, `items`, and the bundle only. Live kinds read the store through selectors, exactly as contracts 1.3a lists.

| Kind | Reads | Behaviour |
|---|---|---|
| `rich_text` | `data.blocks` | Renders each block through `registry.blocks` (7.5); an unknown block kind renders nothing |
| `hero` | `data` | Title as `<h1>` (the first hero on a page) or `<h2>`, tagline, icon above the title, up to two links as buttons; `height` picks a min-height token; the background image, when the frame's `presentation.background` is media, is the frame's cover image with its overlay |
| `media` | `data.layout`, `items` | `single`: one image with caption; `grid`: CSS grid with `data.columns`; `carousel`: one at a time with previous and next buttons and swipe, no autoplay, crossfade unless reduced motion; an item with `link` wraps the image |
| `links` | `data.style`, `items` | Buttons, cards (label, icon, description), or a list |
| `icon_row` | `data`, `items` | Decorative row of icons with optional labels; icons `aria-hidden` when unlabelled |
| `divider` | `data.style` | A line, a row of snowflake icons, or a string of lights (CSS) |
| `funds_ring` | `snapshot.event.fundsPercent`, `year` | SVG ring filled to the percent with the number in the middle, animated fill unless reduced motion; `showYear` adds the year to the heading; 0 and no year when `event` is null |
| `countdown` | `snapshot.event.scheduledAt`, `live.eventStatusId` | `Xd Xh Xm Xs` from the 1 s clock; renders nothing unless status is 2 and `now < scheduledAt`; blank while `!timeReady` |
| `event_times` | `snapshot.event.scheduledAt`, `wentLiveAt`, `endedAt`, `live.eventStatusId` | One labelled line per field in `data.fields` whose value exists, formatted in `America/Denver`; `airborneFor` is `formatElapsed(now - wentLiveAt)` on the 1 s clock while status is 3; blank while `!timeReady` |
| `latest_message` | `snapshot.event.latestMessage` | `card`: body plus `eventTime` (or `createdAt` when null); `ticker`: one collapsible line; `aria-live="polite"`; nothing when null |
| `map` | the live object, `snapshot.event.flightHistory`, and everything section 8 lists | The live screen (7.6) |
| `leaderboard` | `live.cookieTally`, `snapshot.cookieTypes` | Section 9 |
| `sponsor_carousel` | `snapshot.sponsors`, `bundle.media` | Section 15; logo through `Media` with `sizes` fixed at `data.logoWidth` |
| `sponsor_grid` | `snapshot.sponsors`, `bundle.media` | Every sponsor in snapshot order (pinned first, then largest gift first; the site never re-sorts): the first three as large cards, the rest in a four-column grid; logo (name text when `logoMediaId` is null), name, links for `websiteUrl`, `fbUrl`, `igUrl` when non-null, `yearsAsSponsor` as "Sponsor for N years" when `showYears`; no tiers, no amounts; `emptyText` when none |
| `route_preview` | `snapshot.event.routeImageMediaId`, `bundle.media` | `image`: the poster through `Media` (960 variant, `srcset`) wrapped in a link to the page holding the `viewer` style, or unlinked when no such page is published; `viewer`: the pan-and-zoom viewer of 8.5 over the asset's original `url`, with `data.disclaimer` rendered above it; `emptyText` when the id is null or unresolvable |
| `cookie_control` | auth, `live.eventStatusId`, `snapshot.cookieTypes` | Section 10; `closedCopy` outside status 3; `signedOutCopy` with a sign-in link when signed out |
| `alerts_signup` | auth, `GET /me`, `GET /me/subscriptions` | Section 13; `signedOutCopy` with a sign-in link (`returnTo` the current path) when signed out |
| `contact_form` | `settings.contactEmail` | Section 14 |

Headings: every kind with a `heading` renders it as `<h2>` when non-null. Copy fields (`copy`, `caption`, `emptyText`, and the rest) are `Inline`.

### 7.5 Blocks and inline text

Blocks render through `registry.blocks` inside `rich_text`: `heading` (`<h1>` to `<h3>` by `level`, icon before the text), `paragraph`, `list` (bullet, numbered, or icon-marked with `data.icon` before each item), `quote` (`<blockquote>` with `<cite>`), `media` (`Media` at `small` 320 px, `medium` 640 px, or the frame width, with a `<figcaption>`), `links` (buttons or a list), `icon` (one icon at `sm` 24, `md` 48, `lg` 96, `xl` 160 px, aligned), `divider`.

`inline/parse.ts` is the site's copy of the grammar in contracts 1.3a and mirrors the API's parser: it tokenizes `**`, `*`, backtick, `[label](href)`, `{icon:<id>}`, `{icon:media:<uuid>}`, `{event:name}`, `{event:year}`, `{event:scheduledAt}`, and newlines; everything else is text; unbalanced markers are text. `Inline.tsx` maps tokens to `<strong>`, `<em>`, `<code>`, `LinkView`, `Icon` (inline-sized, `aria-hidden`), `<br>`, and text nodes. Placeholders resolve through `inline/placeholders.ts` from `snapshot.event` (`name`, `String(year)`, `scheduledAt` formatted in `America/Denver`; empty string when `event` is null or the field is null). There is no `dangerouslySetInnerHTML` anywhere in the site.

### 7.6 The live screen (`map` section)

Full-viewport map with overlays, each switched by `data.overlays` and each control by `data.controls`:

| Component | Reads | Behaviour |
|---|---|---|
| `MapView` + `mapController` (`Map.tsx`) | `live.lat`, `live.lng`, `snapshot.event.flightHistory`, theme, map type, `data.defaultCenter`, `data.defaultZoom`, `data.themes`, `data.defaultTheme`, `data.flightHistoryDefault` | Section 8. The map shows one marker at Santa's current position and nothing about where he has been |
| `santaMarker` | `live.lat/lng`, `selectLiveState` | Position on each applied object; `waitingForFix` shows no marker at the default view; `signalLost` swaps to the signal-lost icon variant and the marker stays put. The marker is the legacy idea kept: a map pin wearing a Santa hat, drawn inline in the accent |
| `LiveIndicator` | `hub`, quiet state, `live.publishedAt` | A pill: the dot, "Live" when `hubLive` or "Updating" when `pollingOnly`, then "Updated N s ago" from `publishedAt` on the device clock |
| `FixStatus` | `selectLiveState`, `lastSeqChangeAt` | A pill under the live indicator only while waiting for the first fix or after the signal is lost (in `--err`) |
| `LiftoffTimer` | `snapshot.event.wentLiveAt` | A pill with the takeoff glyph: "Airborne 1h 12m" via `formatElapsed`; absent when `!timeReady` or `wentLiveAt` null |
| `DistanceChip` | user location, `live.lat/lng` | A pill with the person-pin glyph: feet under one mile, miles with two decimals otherwise; only when location is enabled and a fix exists |
| `LiveStrip` | `live.speedMps`, `headingDeg`, `altitudeM` | The instrument line: one pill with speed (mph), heading (degrees and cardinal), and altitude (feet) in mono |
| `LatestMessage` overlay | `snapshot.event.latestMessage` | Collapsible ticker on the glass surface under the pills; `aria-live="polite"`; absent when null |
| `Leaderboard` overlay | `live.cookieTally`, `snapshot.cookieTypes` | Section 9, the cookie panel under the tracker menu button, top-right; `panel` variant, compact rows, collapsible from its header |
| `SponsorCarousel` overlay | `snapshot.sponsors` | Section 15, the `tile` variant bottom-left, logos at the 480 px size |
| `CookieControl` overlay | auth, `snapshot.cookieTypes`, `GET /me/cookies` | Section 10, `data.compact`: one pill above the sponsor tile ("Sign in to leave a cookie" or "Leave a cookie"), the sheet on tap |
| `TrackerMenu` | themes, map type, toggles, `live.speedMps/headingDeg/altitudeM/accuracyM`, distance, liftoff | The legacy tracker's card in the top-right corner (301 px, the full width on a phone, the frost recipe): the six map styles as round thumbnails with a nickname and an accent underline on the active one; a row of Terrain, Road, and Snow; the data row as a glyph and a value per item (speed, heading, altitude, accuracy, distance, liftoff, recorded, received); then a row of 44 px square buttons: location (opens `LocationPrompt`), flight history (the projected route from a previous flight, off unless `data.flightHistoryDefault`), time labels, fit history, close. Each entry present only when its control is on, and the flight history entries also only when `snapshot.event.flightHistory` is non-null |
| `MapControls` | follow state | Bottom-right: zoom in and out stacked in one 44 px column while following; a single recenter button once the visitor has dragged (a drag stops following; recenter resumes it) |
| `RouteDisclaimer` | `storage` key `wmsfo.routeDisclaimerAck` | Dialog on the first live-screen visit per browser; "I understand" stores the key |
| `Snow` | menu toggle, reduced motion | The site's snow layer, off by default on the live screen; the tracker menu's Snow toggle is the same per-visitor switch |
| `wakeLock` | mount | Section 8.8 |

Data row units: speed as mph from `speedMps`, heading as degrees plus cardinal from `headingDeg`, altitude as feet from `altitudeM`, accuracy as feet from `accuracyM`; a null field shows a placeholder from `copy.ts`. `recordedAt` and `receivedAt` are shown in the data row as times; they decide nothing.

**The takeover.** While `live.eventStatusId === 3` and no preview is loaded, the live page renders its `map` section alone (`PageRenderer` drops every other section of that page), the section is fixed to the viewport (`position: fixed; inset: 0`), the shell renders neither header, banners, nor footer, and `<html data-takeover="live">` locks scrolling. Nothing else on the site is visible or reachable until the status changes; the tracker menu is the only menu. The layout follows the legacy tracker: pills 8 px from the top-left corner (the live indicator, the fix status, the airborne time, the distance, the instrument line with speed, heading, and altitude, then the message ticker), the tracker menu button and the cookie panel top-right, the cookie pill and the sponsor tile bottom-left, zoom (while following) or recenter (after a drag) bottom-right. Every pill is 34 px tall, every button 44 px, on the shared glass surface (`--panel` at 86 percent with a backdrop blur), and every colour on the live screen comes from the chosen map style's chrome (8.4), as the legacy tracker's did; the tracker menu is the style's panel colour. While the menu is open the top-left pills, the cookie panel, and the map controls are hidden, as the legacy tracker did.

### 7.7 Shell, theme, footer

`Shell` wraps every route: skip link, `<header>` with the site name and logo icon from `settings`, the menu button (`aria-expanded`, `aria-controls`), the `<nav>` panel from `content/nav.ts`, the `updatesPaused` and `preview` banners, the reload prompt when `schemaMismatch`, and a `<footer>` with `settings.footerLinks` and `settings.footerText`. While the event is live (7.6, the takeover) the shell renders only the page: no header, no banners, no footer, and the document does not scroll. Off the takeover the root is a column that fills the viewport and the page's `<main>` takes the slack, so the footer sits at the bottom of the viewport on a short page and after the content on a long one.

**Colour scheme.** The site has one visual direction, North Pole Night, in a dark and a light rendering, and the visitor chooses light, dark, or follow the system. `data-theme="light"` or `"dark"` on `<html>` is the resolved scheme. An inline script in `<head>` of `index.html`, before any stylesheet, reads `localStorage["wmsfo.theme"]` (`"light"` or `"dark"`; absent or anything else means system) and `matchMedia("(prefers-color-scheme: dark)")` and stamps the attribute, so the first paint is already right. `content/theme/colorScheme.ts` owns the rest: a `change` listener on the media query keeps a system-following visitor live; the header's theme picker (`ThemePicker`: a sun or moon button that opens a small menu of Light, Dark, and System with the current choice checked) stores light or dark, and System removes the stored key. There is no other scheme control anywhere on the site. Nothing about the scheme is in the snapshot or the site settings. Non-CSS consumers (the map's overlay palette, canvas snow) follow the attribute through a `MutationObserver`, as the portfolio does.

**Tokens.** `content/theme/tokens.css` is the only file in the repository with a colour literal: the dark palette on `:root[data-theme="dark"]` and the light palette on `:root[data-theme="light"]`, the same token names in both (`--ground`, `--panel`, `--panel-2`, `--line`, `--text`, `--text-bright`, `--text-dim`, `--accent`, `--accent-soft`, `--on-accent`, `--gold`, `--link`, `--ok`, `--warn`, `--err`, `--shadow`, `--snow`, `--frost-a`, `--frost-b`), plus the type scale, spacing, and the two radii (6 and 10 px). The values are the North Pole Night set:

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
| `--ok` | `#56d29a` | `#1f7f4f` | status good, live dot |
| `--warn` | `#f0c05a` | `#8a6210` | status degraded, disclaimer |
| `--err` | `#ff7a70` | `#c2362c` | status down, validation errors, the Santa hat on the pin |
| `--shadow` | `none` | `0 1px 3px rgba(15,26,48,.08)` | panels (dark has no shadows) |
| `--snow` | `rgba(255,255,255,.85)` | `rgba(140,165,205,.55)` | snow flakes |
| `--frost-a`, `--frost-b` | `rgba(111,211,255,.4)`, `rgba(255,122,112,.28)` | `rgba(11,107,181,.2)`, `rgba(194,54,44,.14)` | the aurora halo behind frost glass |

`docs/design/theme-studio.html` is the reference rendering: every page and home state built on these tokens with the exact component recipes (header, hero with the liftoff card, live strip, Cheer Meter ring, sponsor cards, alerts form, footer, the live map overlays, the poster viewer, the icon set). It is a static mock kept in the repository for the build and for review; the site's CSS modules reproduce its recipes through the tokens, never by copying its literals. Open it in a browser with the "North Pole Night" direction and "Bricolage" face selected. `tokens.contrast.test.ts` parses the file and fails the build when any text token on any surface token drops under 4.5:1 or a status token on `--panel` under 3:1. A hex anywhere else is a review failure. Components are CSS modules co-located with the component (`X.module.css`, typed by `typed-css-modules` so an unknown class fails `tsc`); there is no UI library and no utility framework.

**Type.** IBM Plex Sans for prose and UI, IBM Plex Mono for every value that came from the API at runtime (countdown, funds, speed, distance, times, timestamps) with `font-variant-numeric: tabular-nums`, Bricolage Grotesque for `<h1>` and `<h2>` only. All three are self-hosted through `@fontsource` (section 21; `font-src 'self'`). Body 16 px on 1.5; labels 13 px mono uppercase with 0.12 em tracking; the spacing scale runs 4, 8, 12, 16, 20, 24, 36, 48 px and the section frame pads 20 px vertically at normal spacing.

**Seasonal layers.** `settings.theme.snowDefault` is the initial state of the snow toggle on every page except the live screen; the visitor's switch (the menu drawer and the footer's Snow chip, and the tracker menu on the live screen) is stored under `wmsfo.snow`. `settings.theme.lightsDefault` turns the string of lights under the header on or off for everyone; the visitor has no lights switch. Snow is a canvas of small, slow, translucent flakes coloured by `--snow` (half-strength white in dark, a faint blue-grey in light, about one flake per 30,000 square pixels), fixed at `z-index: 0` so it falls over the ground and the section backgrounds but behind every positioned surface: the cards, the header, the footer, and the text; on the live screen it sits over the map. Lights are a row of 7 px bulbs on a 1 px wire in the accent, gold, ok, and err tokens with a slow twinkle. Frost glass (the studio's liftoff card: an aurora halo in `--frost-a` and `--frost-b` blurred 12 px just outside the panel, over it a glass layer of `--panel` at 78 percent with `backdrop-filter: blur(10px)` and a border tinted 40 percent toward the accent; both are pseudo-elements of the `.frost` class in `theme/Frost.module.css`, so a composing class sets only its own padding) is the panel recipe for the site's cards: the liftoff card, the Cheer Meter, the event times list, the latest message card, the sponsor carousel card, and the full leaderboard. The live screen's surfaces follow the map style instead (7.6, 8.4). `settings.favicon` replaces the `<link rel="icon">` href with the resolved icon URL when set; the defaults are applied whenever the bundle changes.

**Motion.** Hover is a 120 ms ease-out change of border or colour and nothing moves more than 2 px; focus is a 2 px accent outline with a 2 px offset; the hero rises 12 px on load with a 60 ms stagger; the funds ring and leaderboard reorder animate as section 17 says. Every tap target is at least 44 px.

**Icons.** Library icons are inline SVG components generated at build time from the vendored `contracts/icons/<id>.svg` files (the API repository publishes its icon library there beside the schemas, so the contracts check covers them) (24 px grid, 1.75 px stroke, round caps and joins, `stroke="currentColor"`), so they take the accent; the `Icon` primitive renders a library id inline and a media id through `<img>`. A library id missing from the generated set falls back to `<img>` from `bundle.icons`.

### 7.8 Preview

`/preview?token=wpv_...&page=<slug>`: `PreviewPage` calls `GET <api>/preview/document?token=` (the one CDN-free read on the site; `credentials: "omit"`, no bearer), stores the bundle as `store.preview`, shows the `Preview` banner, and renders the page whose `slug` matches (a role page by its slug, whatever the current status; a missing `page` renders the home selection). Live sections read the real store, so the map, tally, and sponsors are live data under draft content. The data loop runs as usual. A `404` renders "This preview link has expired" with no retry; nothing about the preview is persisted; the store's `preview` is cleared on navigation away. Search engines never see it: `/preview` carries `<meta name="robots" content="noindex">` set by the page.


---

## 8. Map layer

### 8.1 Loading

```ts
// src/map/loadMaps.ts
import { Loader } from "@googlemaps/js-api-loader";
let loader: Loader | null = null;
export async function loadMaps() {
  loader ??= new Loader({ apiKey: env.GOOGLE_MAPS_KEY, version: "weekly" });
  const [maps, marker, geometry] = await Promise.all([
    loader.importLibrary("maps"), loader.importLibrary("marker"), loader.importLibrary("geometry"),
  ]);
  return { maps, marker, geometry };
}
```

`src/map/**` is imported with `import()` from `sections/Map/Map.tsx` and from `sections/RoutePreview` (style `map`) only. A load failure (blocked script, bad referrer, offline) renders the map area as a "map unavailable" panel with a retry button; the data row, leaderboard, message, carousel, and cookie control still work because they read the store, not the map.

### 8.2 Map options

```ts
{
  center: data.defaultCenter,        // the map section's data; replaced by the first fix or the route bounds
  zoom: data.defaultZoom,
  minZoom: 5,
  mapTypeId: "terrain",
  disableDefaultUI: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  keyboardShortcuts: true,
  styles: theme.styles,              // JSON style array; no mapId
}
```

Classic `google.maps.Marker` and `google.maps.Polyline` with JSON `styles` (a `mapId` would disable JSON styling, and themes live in the repo).

Initial view: when a fix exists, centre on it at `data.defaultZoom`; otherwise `data.defaultCenter` at `data.defaultZoom`.

### 8.3 Controller

`mapController` owns the `google.maps.Map` and exposes: `setTheme(key)`, `setMapType("terrain" | "roadmap")`, `follow(on)`, `recenter()`, `zoomBy(delta)`, `fitHistory()`, `destroy()`. It subscribes to the store once and, on each applied object whose `seq` changed, calls `santaMarker.setPosition` and, while following, `map.panTo`. `dragstart` sets `follow(false)`; the recenter button sets `follow(true)` and pans. `zoom_changed` (debounced 150 ms) redraws the flight history overlay so arrow density and label interval match the zoom.

### 8.4 Themes

Map styles are separate from the site's colour scheme: the picker in the tracker menu stays, exactly as the legacy tracker had it, and the chosen style does not change when the visitor flips light and dark. `src/map/themes/index.ts` exports an ordered registry; the six style arrays are the legacy tracker's (Standard, Retro, Silver, Dark, Night, Aubergine, carried over unchanged under the new names) and each carries the overlay palette the flight path layer needs plus a `chrome` palette: what the tracker's pills, panels, tiles, buttons, and dialogs paint with while that style is on, again the legacy tracker's colours. The map section rebinds the site's surface tokens (`--panel`, `--panel-2`, `--text`, `--text-bright`, `--text-dim`, `--line`, `--accent`, `--accent-soft`, `--shadow`) to the chrome on its root, so everything inside it follows the map style and nothing inside it follows the site's light or dark scheme. The picker shows each style as the legacy round thumbnail (`public/tracker-themes/<key>.png`) in a three by two grid. The `map` section's `data.themes` picks which registry keys the theme picker offers (unknown keys are ignored; an empty result falls back to the whole registry) and `data.defaultTheme` the starting one; the registry keys are what the panel's schema enumerates.

```ts
export type MapTheme = {
  key: "standard" | "expedition" | "blizzard" | "charcoal" | "night" | "nebula";
  label: string;
  styles: google.maps.MapTypeStyle[];
  routeColor: string; routeOpacity: number;
  arrowColor: string;
  timeLabelBg: string; timeLabelFg: string; timeLabelOpacity: number;
  userColor: string;
  chrome: { bg: string; fg: string; text: string; tile: string; tileFg: string; panel: string; accent: string };
};
export const THEME_KEYS = ["standard", "expedition", "blizzard", "charcoal", "night", "nebula"] as const;   // the enum in contracts/schema/sections/map.schema.json
```

The chosen key persists in `localStorage["wmsfo.tracker.theme"]` through `lib/storage.ts` (guarded; a blocked storage, or a stored key the section no longer offers, falls back to `data.defaultTheme`). Theme changes apply `map.setOptions({ styles })`, redraw the flight path overlay, and recolour the user marker and dotted line.

### 8.5 Flight history overlay and the route poster viewer

**Flight history.** Input: `snapshot.event.flightHistory.points` (`{ lat, lng, recordedAt }[]`, route order, already thinned by the API; contracts 1.3). It is a previous flight drawn as the projected route, the legacy tracker's "history" toggle; it is not where Santa has been tonight. Two toggles from the menu, `flightHistory` (initial state `data.flightHistoryDefault`, off by default) and `timeLabels` (on by default), kept in component state; both absent when `flightHistory` is null.

- **Line**: one geodesic `Polyline`, `strokeWeight 2`, `strokeColor theme.routeColor`, `strokeOpacity theme.routeOpacity`.
- **Arrows**: a second `Polyline` with `strokeOpacity 0` and `icons[]` of `FORWARD_CLOSED_ARROW` symbols placed every `step` points, where `step` is 20 at zoom 15 and above, 40 at 13 to 14, 80 at 11 to 12, 150 at 9 to 10, 250 below; symbol scale 3 at zoom 9 and above, else 2.
- **Time labels**: markers with an SVG data-URI icon (rounded box, label text, a dot in `routeColor`), one label each time the elapsed time from the first point with a non-null `recordedAt` crosses the next interval; interval 5 minutes above zoom 12, else 20 minutes. Label text `35 min`, `1 hr`, `1 hr 20 min`. Points with `recordedAt` null are skipped for labels; no labels when no point has a time.
- Redraw on zoom, theme change, toggle change, and when a new snapshot carries a different `flightHistory.routeId`. All previous overlays are removed first. `fitHistory()` is offered as a menu action when the overlay is on.

**Route poster viewer** (`src/content/sections/RoutePreview/PosterViewer.tsx`, the `viewer` style; no Maps script). One `<img>` of the asset's original `url` inside a clipped, `touch-action: none` frame, positioned by a CSS transform `translate(x, y) scale(s)`. Fit on load (`s = min(frameW / imgW, frameH / imgH)`, centred); `s` clamps between fit and six times fit. Drag with pointer capture, wheel zoom about the cursor, pinch zoom about the midpoint, double-tap zooms in one step, and three buttons: zoom in, zoom out, fit (the same `.ibtn` recipe as the map controls). Arrow keys pan and plus and minus zoom when the frame has focus. The `image` style is a plain linked `Media` picture and loads nothing else. Neither style loads the map chunk.

### 8.6 User location and distance

```ts
// src/map/userLocation.ts
export type UserLocationState = { enabled: boolean; position: google.maps.LatLngLiteral | null; error: GeolocationPositionError["code"] | null };
export function createUserLocation(map, theme, onChange: (s: UserLocationState) => void) {
  return { enable(), disable(), setTheme(theme), setSanta(pos: LatLngLiteral | null), destroy() };
}
```

- `enable()`: if `navigator.permissions?.query` exists, query `geolocation`; `denied` reports the error without calling geolocation. Otherwise `navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 })`. `disable()` clears the watch and removes the marker and line.
- User marker: `SymbolPath.CIRCLE`, scale 8, `fillColor theme.userColor`; pulses by toggling visibility every 600 ms unless reduced motion, in which case it is static.
- Dotted line: `Polyline` from Santa to the user with `strokeOpacity 0` and a small circle symbol repeated every 10 px in `theme.routeColor`; redrawn when either end moves.
- Distance: `geometry.spherical.computeDistanceBetween(user, santa)` in metres; displayed as feet (`Math.round`) under 1609.344 m, otherwise miles to two decimals, grouped with commas.
- State is per page load. Nothing about location is persisted.

`LocationPrompt` is a `<dialog>` opened from the menu's location button. Disabled state: explains why location is asked, warns when `inAppBrowser()` is true (user agent contains `FBAN`, `FBAV`, or `Instagram`) that location may not work inside the Facebook or Instagram browser and suggests opening the page in the system browser, gives OS-specific steps (iOS, Android, desktop) for a previously blocked permission, and offers Enable and Cancel. Enabled state: offers Disable and Back. After a `PERMISSION_DENIED` error the prompt reopens on the instructions section.

### 8.7 Marker states

| State | Marker | Chip |
|---|---|---|
| `waitingForFix` | none; map at `data.defaultCenter` and `data.defaultZoom` | "Waiting for the first fix" |
| `tracking` | Santa icon anchored bottom-centre at `live.lat/lng` | none |
| `signalLost` | Same position, signal-lost icon variant | "No update for N s" from `lastSeqChangeAt` |

The marker never interpolates or predicts; it moves when an applied object carries a new `seq`.

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
- `variant: "panel"` (top five visible, expand for all) inside the live screen's cookie panel, a 200 px glass panel under the tracker menu button whose header ("Cookies" with a chevron) collapses it; the panel starts open on wide screens and collapsed on phones; `data.compact` renders the 24 px rows the panel uses; `variant: "full"` wherever a `leaderboard` section asks for it, the ended page in the starter content. `data.emptyText` renders when there are no types.

---

## 10. Cookie control

Rendered by the `cookie_control` section and by the live screen's overlay. Outside `live.eventStatusId === 3` it renders `data.closedCopy` and nothing else. Signed out: `data.signedOutCopy` and a sign-in link using the auth sign-in action with `returnTo` the current path. Signed in: a button opening a bottom sheet.

Flow:

1. On open: `GET /me/cookies`. Render `remaining` of `limit`, the type picker from `snapshot.cookieTypes` (icon and name), and an optional note field (max 140 characters, counter shown). Notes are never displayed anywhere on the site.
2. Submit: `POST /cookies { cookieTypeId, note }` (`note` omitted when empty, sent as `null`). Disabled while a request is in flight and while `remaining === 0`.
3. `201`: show a confirmation, set `remaining` from the response, clear the note. The leaderboard changes when the next live object carries the new tally; the control does not touch the store.

| Response | Handling |
|---|---|
| `409 cookie_limit_reached` | `remaining = 0`, submit disabled, copy "You have left all your cookies for this year" |
| `409 no_live_event` | Close the sheet, `pollNow()`; the screen switch follows the live object |
| `404 not_found` | The type is no longer active; refresh the picker from the current snapshot and ask to pick again |
| `401 unauthenticated` | Attempt a silent renew; on failure show the sign-in link |
| `429 rate_limited` | Disable submit for `details.retryAfterSeconds` seconds with a countdown |
| `400 validation_failed` | Show the note field error from `details.fields.note` |
| Network or `5xx` | Generic retry copy; `message` from the error body is never shown |

`GET /me/cookies` runs once per open of the sheet (a live poll never refetches it); the site keeps no cookie state between opens beyond what the last response said. `data.compact` (the live screen) renders the control as one pill: "Sign in to leave a cookie" when signed out, "Leave a cookie" when signed in, nothing outside status 3.

---

## 11. Accounts

### 11.1 UserManager

```ts
// src/auth/userManager.ts (import()ed on demand)
import { UserManager, WebStorageStateStore } from "oidc-client-ts";
export const userManager = new UserManager({
  authority: env.COGNITO_AUTHORITY,
  client_id: env.COGNITO_CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  response_type: "code",
  scope: "openid email profile",
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  loadUserInfo: false,
  monitorSession: false,
});
```

- Discovery comes from `${authority}/.well-known/openid-configuration`; the authorize and token endpoints it names are on `<cognito-domain>`. There is no `end_session_endpoint`.
- PKCE is the library default for `response_type: "code"`.
- Token storage: `localStorage` under the library's `oidc.user:<authority>:<client_id>` key so a person who signs in before the event is still signed in on event night (refresh token lifetime 30 days on `wmsfo-site`). Only the ID token is ever sent anywhere, and only to `VITE_API_BASE_URL`.
- Silent renew: with a refresh token present the library renews through the token endpoint's refresh grant; no iframe is used. `events.addAccessTokenExpiring` triggers it automatically; `events.addSilentRenewError` marks the session as needing sign-in.
- The auth chunk loads when: the `/auth/callback` route mounts, the sign-in action runs, or `localStorage` holds the library's user key at boot (a synchronous key-existence check in `main.tsx`; the chunk then hydrates the signed-in state).

### 11.2 Sign in, callback, sign out

```ts
export async function signIn(returnTo: string) {
  const um = await getUserManager();
  await um.signinRedirect({ state: { returnTo } });
}

// AuthCallback.tsx
const user = await userManager.signinRedirectCallback();
navigate((user.state as { returnTo?: string } | undefined)?.returnTo ?? "/", { replace: true });
// on error: render "Sign-in did not complete" with a Try again link (signIn("/")) and a Home link

export async function signOut() {
  const um = await getUserManager();
  await um.removeUser();
  const logoutUri = encodeURIComponent(`${window.location.origin}/`);
  window.location.assign(`${env.COGNITO_DOMAIN}/logout?client_id=${env.COGNITO_CLIENT_ID}&logout_uri=${logoutUri}`);
}
```

`${window.location.origin}/` is the registered sign-out URL for every origin the site runs on (production, preview, `localhost:5173`).

### 11.3 Auth state for React

```ts
type AuthState =
  | { status: "unknown" }                             // chunk loading or hydrating
  | { status: "signedOut" }
  | { status: "signedIn"; email: string; expired: boolean };
```

`AuthProvider` subscribes to `events.addUserLoaded`, `addUserUnloaded`, `addUserSignedOut`, `addSilentRenewError`. It attaches those subscriptions through `onUserManagerReady` in `userManager.ts`, which fires when the manager is constructed by whichever caller loads it first: the provider itself when a session is stored at boot, or `AuthCallback` when a sign-in is completing. The provider never imports the chunk for a signed-out visitor, and a sign-in completed on the callback page reaches it without a reload. `useAuth()` returns the state plus `signIn(returnTo)` and `signOut()`. Every public page works in `signedOut`; nothing blocks on `unknown` except the alerts page content and the cookie control, which render their signed-out variants until `signedIn` arrives.

### 11.4 Bearer for API calls

```ts
export async function getIdToken(): Promise<string> {
  const um = await getUserManager();
  let user = await um.getUser();
  if (user?.expired) { try { user = await um.signinSilent(); } catch { user = null; } }
  if (!user?.id_token) throw new SignInRequired();
  return user.id_token;
}
```

Re-read before every call; never cached by the API client.

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
| `GET /me/subscriptions` | bearer | Alerts page |
| `POST /me/subscriptions` | bearer | Alerts page |
| `POST /me/subscriptions/{id}/resend-verification` | bearer | Alerts page |
| `DELETE /me/subscriptions/{id}` | bearer | Alerts page |
| `GET /me/cookies` | bearer | Cookie control |
| `POST /cookies` | bearer | Cookie control |
| `POST /subscriptions/verify` | none | `/alerts/verify` |
| `POST /subscriptions/unsubscribe` | none (JSON body form) | `/alerts/unsubscribe` |
| `POST /contact` | none | Contact page |

---

## 13. Alerts pages

### 13.1 The `alerts_signup` section (signed in)

On mount: `GET /me` and `GET /me/subscriptions` in parallel, once per sign-in; a live poll re-renders the page but never refetches these. Renders:

- The account email from `person.email`.
- A form: address (prefilled with the account email, editable), submit `POST /me/subscriptions { channel: "email", address }`. The site trims the address; the API lowercases it.
- The list of `Subscription` rows: `address`, state (`verifiedAt` null: "Pending, check your email"; `unsubscribedAt` set: "Unsubscribed"; otherwise "Active"), `createdAt`. Actions per row: **Resend confirmation** when `verifiedAt` is null and `unsubscribedAt` is null (`POST .../resend-verification`, `202`), **Unsubscribe** when `unsubscribedAt` is null (`DELETE`, `204`), **Re-subscribe** when `unsubscribedAt` is set (`POST /me/subscriptions` with the same address, which re-activates the row).
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

`SponsorCarousel` (the `sponsor_carousel` section and the live screen's overlay): plays `snapshot.sponsors` in snapshot order (pinned sponsors first in their pinned order, then largest gift first; never shuffled), shows one sponsor at a time for its `lingerMs`, wraps around, pauses while the document is hidden. A tap on the sponsor opens a small centred `<dialog>` with the logo, the name, a "Visit website" link to `websiteUrl ?? fbUrl ?? igUrl` (in a new tab; absent when all three are null), and a Close button; the dialog closes on Close, on Escape, and on a tap outside it. Nothing in the carousel links to a sponsors page. `data.variant` is `card` (the section: logo tile, name, the "N s on the tracker" line, the dots) or `tile` (the live screen: the legacy tracker's bare logo tile, 70 px tall and at most 180 px wide on the glass surface, the name as text when there is no logo). A snapshot change keeps the current index when the sponsor at it is unchanged, else restarts at the first. Input is every sponsor in `snapshot.sponsors`; a sponsor without a logo shows its name as text. Logos render through `Media` with `sizes` fixed at the section's `logoWidth` (480 for the overlay). Crossfade is disabled under reduced motion.

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

Enabled only when `settings.analyticsEnabled` is true in the current bundle (checked when the first snapshot is held; a later publish that turns it off stops page views at the next navigation), both `VITE_ANALYTICS_ID` and `VITE_ANALYTICS_ORIGINS` are set, and the page origin is in the list; both are set in the Vercel Production environment only, so preview deployments, PR previews on `*.vercel.app` hosts, and local runs send nothing. The router sends one `page_view` per navigation. No user identifier, email, or location is ever sent; events are page views only.

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
| Marker pulse (user), signal-lost pulse | Static icons |
| Marker movement | `setPosition` is instant either way; `panTo` is replaced by `setCenter` |
| Sponsor carousel | Rotation continues (it is content), crossfade removed |
| Leaderboard reorder, funds ring fill, countdown digits | Instant |
| Menu and sheet transitions | Instant |

CSS also carries a global `@media (prefers-reduced-motion: reduce)` rule zeroing transition and animation durations.

---

## 18. Performance budget and code splitting

Chunks (`build.rollupOptions.output.manualChunks`):

| Chunk | Contents | Loaded when | Gzipped budget |
|---|---|---|---|
| `index` | React, router, store, shell, the page renderer, every section and block component except the map | First paint | 130 KB |
| `signalr` | `@microsoft/signalr` | After the first live object is applied (startup step 3) | 45 KB |
| `map` | `src/map/**`, `@googlemaps/js-api-loader`, themes | A `map` section mounts | 50 KB (Google's own script excluded) |
| `auth` | `oidc-client-ts`, `AuthProvider` internals, `AuthCallback` | Callback route, sign-in click, or a stored session at boot | 40 KB |
| `alerts` | The two token landing pages | Route mounts | 15 KB |
| CSS | all | First paint | 25 KB |

Budgets are enforced in CI with `size-limit` (`package.json` `"size-limit"` entries per chunk pattern); a failed budget fails the build.

Targets on a mid-range Android over 4G: LCP under 2.5 s on every non-live screen, map interactive under 4 s after the switch to the live screen, no long task over 200 ms on a fix.

Other rules:

- `index.html` carries `<link rel="preconnect" href="%VITE_CDN_BASE_URL%" crossorigin>` and a `modulepreload` for `index`.
- Every image goes through the `Media` primitive with `srcset` and `sizes`, so a phone downloads the 480 px variant; every `<img>` has `loading="lazy"` and `decoding="async"` except a hero background and the first carousel logo.
- Flight history redraws on zoom are debounced (150 ms); time-label markers are created once per redraw, not per point.
- The store publishes one state object per applied live object; components select fields, so a fix re-renders the data row and the live indicator and nothing else.
- No polyfills for browsers without WebSockets, `fetch`, or `AbortController`; `browserslist` is "defaults, not dead".

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
| Hub never connects or keeps dropping | Live indicator shows "Updating" (polling only); polling tightens while live; no banner |
| Snapshot fetch failing | Old snapshot keeps rendering; the page still switches on the live object; small "refreshing details" note |
| Maps script fails | "Map unavailable" panel with Retry; everything else on the live screen works |
| Geolocation error | Prompt reopens on the instructions section; distance chip hidden |
| API call fails | Inline copy per code (sections 10, 13, 14); never the server's `message` |
| Render error | Root `ErrorBoundary` renders a plain page with a Reload button; the data loop keeps running underneath |
| Unknown slug | `NotFound` |
| Site misconfigured (missing `VITE_` value) | Plain configuration error page naming the variable, before anything else runs |

Nothing retries less often than every 5 s and nothing ever gives up, matching the loop's backoff. The device clock drives every displayed duration; the site does not correct for clock skew.

---

## 20. Accessibility

- Landmarks: `<header>`, `<nav aria-label="Site">`, `<main>`, and a skip link to `main`. The tracker map container is `<div role="region" aria-label="Santa tracker map">` with a visually hidden text alternative (position, speed, distance when known) updated at most every 10 s.
- Menu button: `aria-expanded`, `aria-controls`; the panel traps focus while open and closes on Escape.
- Dialogs (`LocationPrompt`, `RouteDisclaimer`, cookie sheet) use the native `<dialog>` element with `showModal()`, a labelled heading, and focus returned to the opener on close.
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
      auth: ["oidc-client-ts"],
      maps: ["@googlemaps/js-api-loader"],
    } } },
  },
  server: { port: 5173, strictPort: true },
});
```

The three families (IBM Plex Sans 400, 500, 600; IBM Plex Mono 400, 500; Bricolage Grotesque 600, 700) are self-hosted in the bundle through `@fontsource` (no third-party font host), so the site loads on networks that cannot reach Google. `index.html` uses Vite's `%VITE_*%` replacement for the CSP meta and preconnect, so no environment value is written into the repository. The authority source ends in `/` because `VITE_COGNITO_AUTHORITY` carries the pool path and a CSP path source without a trailing slash matches that path alone; the slash lets the discovery document under it through:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://maps.googleapis.com https://www.googletagmanager.com;
  connect-src 'self' %VITE_CDN_BASE_URL% %VITE_API_BASE_URL% %VITE_HUB_URL% %VITE_COGNITO_AUTHORITY%/ %VITE_COGNITO_DOMAIN%
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

Vercel serves files that exist before applying the rewrite, so `/assets/*` and `/favicon.svg` are never rewritten; every other path returns `index.html` and the router handles it, including `/auth/callback` and `/alerts/verify`.

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
| `Countdown`, `EventTimes` | countdown format and hide at zero, nothing outside status 2; each field shown only when present; `airborneFor` ticks; `America/Denver` formatting |
| `time`, `units` | `formatElapsed`, `formatCountdown`, `mpsToMph`, feet under a mile and miles over, heading to cardinal |
| `CookieControl` | each response row in section 10 |
| `AlertsSignup`, `VerifyPage`, `UnsubscribePage` | each response row in section 13; token regex gate; post on mount |
| `ContactForm` | limits, trimming, each response row in section 14 |
| `PreviewPage` | fetches with the token, stores the bundle, renders the named page, shows the banner, clears on navigation, handles `404` |
| `api/client` | bearer added only when `auth`; `Retry-After` and `details.retryAfterSeconds`; `204`; `SignInRequired` when no token |
| `analytics` | disabled with an empty id, with an origin not in the list, enabled otherwise |
| `motion` | snow hidden and toggles absent under reduced motion |
| `env` | each missing or malformed variable produces the configuration error |

### 22.2 Playwright against the preview site

Configuration: `baseURL = https://<preview-site-domain>`, Chromium desktop and Pixel 7 emulation, `E2E_API_BASE_URL` (the dev API), `E2E_CDN_BASE_URL`, and the secrets below from the `dev` GitHub environment. The harness refuses to run when `E2E_API_BASE_URL` does not contain `dev`, when `GET /me` for the admin token reports `isAdmin: false`, or when any event in `GET /admin/events` has `statusId` 3 at start.

Secrets: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_TOTP_SECRET`, `E2E_PERSON_EMAIL`, `E2E_PERSON_PASSWORD`, `E2E_BEACON_KEY` (a dev beacon marked active, role `beacon`, named `e2e`).

Harness (`tests/e2e/harness/`):

- `adminToken.ts`: obtains an ID token for the E2E admin (section 25 item 2 decides the mechanism).
- `adminApi.ts`: typed wrappers for `GET /admin/events`, `POST /admin/events/{id}/current`, `POST /admin/events/{id}/status`, `PATCH /admin/events/{id}`, `POST /admin/events/{id}/messages`, `GET /admin/contact-messages`, `DELETE /admin/contact-messages/{id}`, `GET /admin/snapshot`.
- `beacon.ts`: `replay(points, ratePerSecond)` posting fixes over `POST /locations` with `X-Beacon-Key`, `recordedAt = now`.
- `personSignIn.ts`: drives the hosted UI sign-in form for the E2E person (no MFA) through the site's own sign-in link.
- `site.ts`: helpers reading `data-testid` attributes and, on preview builds, `window.__wmsfo.getState()` (exposed only when `VITE_ENV !== "production"`).

Dedicated walk event: year `2100`, name `E2E walk`, created once by an admin in dev with `inheritRoute: true`; the harness locates it by year and aborts when missing. Locations accumulate on it; that is accepted in dev.

`statusWalk.spec.ts`, serial:

1. Record the currently current event id (if any). `POST /admin/events/{walk}/current`.
2. Ensure status 1 (`POST .../status { statusId: 1, notify: false }`, tolerating `409 event_status_unchanged`). Open `/`. Assert the planned page (the role page's first section is present), no countdown, the event name `E2E walk` rendered through a placeholder, no map element.
3. `PATCH { scheduledAt: now + 2 h }`, status 2 with `notify: false`. Assert the countdown appears within `pollIntervalMs + 2000` ms and decreases over 3 s; the scheduled time renders in Mountain time.
4. Status 3 with `notify: false`. Assert the live page's map section renders within `pollIntervalMs + 2000` ms with the waiting-for-fix chip; the live indicator reaches "Live" within 20 s (hub joined) or the test records "polling only" and continues.
5. Read `snapshot.event.flightHistory.points` from the CDN snapshot; `replay(points.slice(0, 60), 2)`. Turn the flight history toggle on and assert one polyline is drawn and the marker is the only thing that moves. Assert the marker's `data-seq` increases and the data row shows a speed within `pollIntervalMs + 2000` ms of the first fix; log the observed latency from POST to marker update.
6. Sign in as the E2E person via the site link; open the cookie control; read `remaining`; leave one cookie of the first type; assert `201`, `remaining` decreased by one, and the leaderboard count for that type increases by one within `2 * pollIntervalMs + 2000` ms.
7. `POST .../messages { body: "E2E <run id>", eventTime: null, notify: false }`. Assert the latest message shows the body within `pollIntervalMs + 2000` ms (snapshot URL change path).
8. Stop replay for 35 s. Assert the signal-lost chip appears after 30 s and the marker keeps its position.
9. Status 4 with `notify: false`. Assert the ended page with the leaderboard showing the count from step 6 and the sponsor grid rendering at least one logo.
10. Status 5 with `notify: false`. Assert the cancelled page shows the message from step 7 and no countdown.
11. Restore: status 4 on the walk event; `POST /admin/events/{previous}/current` when a previous current event existed.

`pages.spec.ts` (parallel): each ordinary page in the published document (read from the CDN snapshot by the harness) renders its first section; the page holding a `route_preview` in `viewer` style shows the poster and zooms on a wheel event without loading the map chunk; the header toggle flips `data-theme` and survives a reload; screenshots of every page and every home state in both schemes are compared against checked-in baselines; `/preview?token=<minted by the harness through POST /admin/content/preview-token>&page=ended` renders the ended page with the preview banner while the walk event is planned; `/alerts/verify?token=wsv_<43 invalid chars>` and `/alerts/unsubscribe?token=wsu_<43 invalid chars>` render the invalid copy after one POST; `/alerts` signed in subscribes a unique address, asserts a Pending row, resends once, then deletes it; the contact form posts a message tagged with the run id and the harness finds and deletes it through the admin endpoints; the 404 page for `/nope`; reduced-motion emulation hides the snow toggle; the CSP meta is present and the hub WebSocket to `<gateway-domain>` opens (network log).

The manual pre-event rehearsal repeats the walk with Red-Nose's replay mode on the real phone in place of `beacon.ts`.

---

## 23. Cut-over

Site-specific steps within the overall cut-over:

1. Create the Vercel project, set the Preview environment to the dev set, push `dev`, run `e2e.yml`, and complete a full status walk against the dev stack.
2. Set the Production environment to the prod set (including `VITE_ANALYTICS_ID` and `VITE_ANALYTICS_ORIGINS`), assign `<site-domain>`, and confirm the domain is in the prod hub `realtimeAllowedOrigins`, the `wmsfo-site` client's callback and sign-out URLs, and the Maps key's referrers.
3. Merge to `main` only after the API cut-over steps have produced `live/location.json` and a snapshot on the prod CDN.
4. Path redirects for links that exist in the wild from the previous site, handled by the router with `<Navigate replace>`: `/santa` to `/`, `/funding` to `/donate`. Every other previous path is a page slug in the starter content (`about`, `sponsors`, `route`, `contact`, `donate`, `alerts`), and editors keep those slugs when they replace the copy.
5. The previous site's per-environment image URLs, route image, copy, and analytics inclusion are not carried; every page, image, and string is content in the panel, the route page renders the route poster linked to the event, and analytics follows section 16 plus the site setting.

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
- The route the public sees is the event's poster image; `route_preview` renders it as a picture or a pan-and-zoom viewer. Nothing on the site fetches the route JSON; the tracker's flight history comes embedded in the snapshot.
- User location uses `watchPosition`, is never persisted, and shows distance in feet under one mile and miles otherwise.
- Wake lock is acquired only on the live screen and re-acquired on visibility.
- Snow follows `settings.theme.snowDefault` on every page except the live screen, where it is off by default, and is absent under reduced motion.
- Countdown hides once `now >= scheduledAt`; the scheduled time stays and nothing implies liftoff. All scheduled and end times display in `America/Denver`.
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
- oidc-client-ts stores the user in `localStorage`; silent renew uses the refresh grant; `loadUserInfo` and `monitorSession` are off.
- API `message` text is never rendered; every code maps to copy in `copy/copy.ts`.
- Analytics is GA4 through gtag, gated by `VITE_ANALYTICS_ID` and an exact-origin list in `VITE_ANALYTICS_ORIGINS`, page views only.
- CSP is a build-time `<meta>` in `index.html` from `VITE_` values; `vercel.json` carries only environment-free headers.
- No service worker and no PWA install prompt.
- No links, copy, or images are constants in the repository beyond the loading, error, and sign-in strings in `copy/copy.ts`.
- Playwright drives fixes over `POST /locations` with a dedicated dev beacon key in CI; the phone's replay mode is used in the manual rehearsal. A fixed dev event, year 2100, is the walk target and keeps its locations.
- Contact form limits follow the API (name 100, email 254, message 2000).
- Bundle budgets enforced with `size-limit`: 130 KB index, 45 KB signalr, 50 KB map, 40 KB auth, 15 KB alerts, 25 KB CSS, gzipped.

## 25. Needs a decision

Nothing at the moment. Add here as it comes up.
