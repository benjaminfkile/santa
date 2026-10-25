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
    flightHistory?: {
      routeId?: number;
      name?: string;
      points?: {
        lat?: number;
        lng?: number;
        recordedAt?: string | null;
      }[];
    } | null;
    latestMessage?: {
      id?: number;
      body?: string;
      createdAt?: string;
    } | null;
    alerts: {
      id: number;
      kind: string;
      statusId: number | null;
      messageId: number | null;
      subject: string;
      message: string | null;
      createdAt: string;
    }[];
    trackerBbox: {
      west?: number;
      south?: number;
      east?: number;
      north?: number;
    };
    trackerStartView: {
      center: {
        lat: number;
        lng: number;
      };
      zoom: number;
    } | null;
    trackerMap: {
      id?: number;
      name?: string;
      bbox?: Bbox;
      minZoom?: number;
      maxZoom?: number;
      terrainMaxZoom?: number | null;
      tilesUrl?: string;
      terrainUrl?: string | null;
    } | null;
  } | null;
  qrCodes?: {
    [k: string]:
      | {
          pageSlug?: string | null;
          forwardUrl?: string | null;
        }
      | undefined;
  };
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
  sponsorsYear?: number | null;
  cookieTypes?: {
    id?: number;
    name?: string;
    icon?: {
      source?: string;
      id?: string;
      display?: unknown;
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
          dzi?: string | null;
          dark?: {
            url?: string;
            variants?: Variants;
          } | null;
          invertInDark?: boolean;
          small?: {
            url?: string;
            variants?: {
              [k: string]: string | undefined;
            };
            dark?: {
              url?: string;
              variants?: Variants;
            } | null;
            invertInDark?: boolean;
          } | null;
          smallMediaId?: string | null;
          credit?: string | null;
          durationMs?: number | null;
          posterMediaId?: string | null;
        }
      | undefined;
  };
  icons?: {
    [k: string]: string | undefined;
  };
  routeMap: {
    path?: {
      lat?: number;
      lng?: number;
    }[];
    timeline?: {
      minutes?: number;
      lat?: number;
      lng?: number;
    }[];
    durationMinutes?: number;
    timed?: boolean;
  } | null;
  routeMapConfig: {
    display?: {
      timeLabelIntervalMinutes?: number | null;
      arrows?: boolean | null;
      arrowSize?: string | null;
      routeWidth?: string | null;
      labelSize?: string | null;
    } | null;
    controls?: {
      fullscreen?: boolean | null;
      terrain?: boolean | null;
    } | null;
  } | null;
  routeView: {
    bbox: {
      west?: number;
      south?: number;
      east?: number;
      north?: number;
    };
    map: {
      id?: number;
      name?: string;
      bbox?: Bbox;
      minZoom?: number;
      maxZoom?: number;
      terrainMaxZoom?: number | null;
      tilesUrl?: string;
      terrainUrl?: string | null;
    } | null;
  };
  trackerThemes: {
    id?: number;
    renderer?: string;
    key?: string;
    name?: string;
    styleUrl?: string;
    spriteUrl?: string | null;
    thumbnailMediaId?: string | null;
    chrome?: {
      bg?: string;
      fg?: string;
      text?: string;
      tile?: string;
      tileFg?: string;
      panel?: string;
      accent?: string;
    };
    overlay?: {
      routeColor?: string;
      routeOpacity?: number;
      arrowColor?: string;
      timeLabelBg?: string;
      timeLabelFg?: string;
      timeLabelOpacity?: number;
      userColor?: string;
      headingColor: string;
    };
    defaultLightMode?: boolean;
    defaultDarkMode?: boolean;
  }[];
  cookieLimitPerPerson: number;
  signUpsOpen: boolean;
  subscriptionsOpen: boolean;
}
export interface Bbox {
  west?: number;
  south?: number;
  east?: number;
  north?: number;
}
export interface Variants {
  [k: string]: string | undefined;
}
