// docs/site.md section 5.1.

import type { LiveObject, Snapshot, ContentDocument } from "../contracts";

export type ContentBundle = {
  content: ContentDocument;
  media: NonNullable<Snapshot["media"]>;
  icons: NonNullable<Snapshot["icons"]>;
};

export type HubStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type Store = {
  live: LiveObject | null;
  snapshot: Snapshot | null;
  snapshotUrl: string | null;
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
    firstLoadStartedAt: 0,
  },
};
