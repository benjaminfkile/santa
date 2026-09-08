// docs/site.md section 5.1.

import type { LiveObject, Snapshot, Route } from "../contracts";

export type ContentBundle = {
  content: Snapshot["content"];
  media: Snapshot["media"];
  icons: Snapshot["icons"];
};

export type HubStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type Store = {
  live: LiveObject | null;
  snapshot: Snapshot | null;
  snapshotUrl: string | null;
  route: Route | null;
  routeUrl: string | null;
  hub: HubStatus;
  lastHubLocationAt: number | null;
  lastSeqChangeAt: number | null;
  schemaMismatch: boolean;
};

export type Diagnostics = {
  online: boolean;
  lastPollOkAt: number | null;
  consecutivePollFailures: number;
  snapshotFetchFailing: boolean;
  routeFetchFailing: boolean;
  firstLoadStartedAt: number;
};

export type SiteStore = Store & {
  diag: Diagnostics;
  preview: ContentBundle | null;
};

export const initialStore: SiteStore = {
  live: null,
  snapshot: null,
  snapshotUrl: null,
  route: null,
  routeUrl: null,
  hub: "disconnected",
  lastHubLocationAt: null,
  lastSeqChangeAt: null,
  schemaMismatch: false,
  preview: null,
  diag: {
    online: true,
    lastPollOkAt: null,
    consecutivePollFailures: 0,
    snapshotFetchFailing: false,
    routeFetchFailing: false,
    firstLoadStartedAt: 0,
  },
};
