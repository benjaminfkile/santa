// Site-facing contract types (docs/site.md section 2). Types come from
// generated/, which is regenerated from contracts/ by `npm run contracts:types`.

import type { LiveObject } from "./generated/live-object";
import type { Snapshot } from "./generated/snapshot";
import type { Route } from "./generated/route";
import type { ContentDocument } from "./generated/content-document";

export type { LiveObject, Snapshot, Route, ContentDocument };
export type Sponsor = NonNullable<Snapshot["sponsors"]>[number];
export type CookieType = NonNullable<Snapshot["cookieTypes"]>[number];

// contracts 0.3 error shape. Not declared in openapi.json because the API
// serializes it outside the endpoint-specific schemas.
export type ApiError = {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
  requestId: string;
};

export type { paths, components, operations } from "./generated/openapi";
