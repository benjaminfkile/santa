/**
 * AUTO-GENERATED FILE. Do not edit by hand.
 * Run `npm run contracts:types` to regenerate from contracts/.
 */

export interface Snapshot {
  schemaVersion?: number;
  event?: {
    id?: number;
    year?: number;
    name?: string;
    statusId?: number;
    scheduledAt?: string | null;
    wentLiveAt?: string | null;
    endedAt?: string | null;
    fundsPercent?: number;
    routeUrl?: string | null;
    latestMessage?: {
      id?: number;
      body?: string;
      eventTime?: string | null;
      createdAt?: string;
    } | null;
  } | null;
  sponsors?: {
    id?: number;
    name?: string;
    websiteUrl?: string | null;
    fbUrl?: string | null;
    igUrl?: string | null;
    logoMediaId?: string | null;
    latestYear?: number;
    yearsAsSponsor?: number;
    lingerMs?: number;
  }[];
  cookieTypes?: {
    id?: number;
    name?: string;
    icon?: {
      source?: string;
      id?: string;
    } | null;
    sort?: number;
  }[];
  content?: unknown;
  media?: {
    [k: string]:
      | {
          url?: string;
          kind?: string;
          width?: number | null;
          height?: number | null;
          alt?: string;
          variants?: {
            [k: string]: string | undefined;
          };
        }
      | undefined;
  };
  icons?: {
    [k: string]: string | undefined;
  };
}
