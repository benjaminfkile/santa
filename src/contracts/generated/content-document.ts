/**
 * AUTO-GENERATED FILE. Do not edit by hand.
 * Run `npm run contracts:types` to regenerate from contracts/.
 */

/**
 * The published content document (contracts 1.3a). Section `data` and `items[].data` are validated by the per-kind schemas under contracts/schema/sections/.
 */
export interface ContentDocument {
  schemaVersion: 1;
  settings: SiteSettings;
  pages: {
    id: number;
    slug: string;
    title: string;
    navLabel: string | null;
    navPosition: number;
    role: "none" | "no_event" | "planned" | "scheduled" | "live" | "ended" | "cancelled";
    sections: {
      id: number;
      kind: string;
      presentation: Presentation;
      data: unknown;
      items: {
        id: number;
        data: unknown;
      }[];
    }[];
  }[];
}
/**
 * Site settings block that publishes with the pages (contracts 1.3a).
 */
export interface SiteSettings {
  siteName: string;
  tagline: string | null;
  homeNavLabel: string;
  logo:
    | (
        | {
            source: "library";
            id: string;
          }
        | {
            source: "media";
            id: string;
          }
      )
    | null;
  favicon:
    | (
        | {
            source: "library";
            id: string;
          }
        | {
            source: "media";
            id: string;
          }
      )
    | null;
  theme: {
    accent: "red" | "green" | "gold" | "blue";
    surface: "night" | "snow" | "forest";
    fontPairing: "classic" | "festive" | "modern";
    snowDefault: boolean;
  };
  /**
   * @minItems 0
   * @maxItems 5
   */
  navExtraLinks:
    [] | [Link] | [Link, Link] | [Link, Link, Link] | [Link, Link, Link, Link] | [Link, Link, Link, Link, Link];
  /**
   * @minItems 0
   * @maxItems 10
   */
  footerLinks:
    | []
    | [Link]
    | [Link, Link]
    | [Link, Link, Link]
    | [Link, Link, Link, Link]
    | [Link, Link, Link, Link, Link]
    | [Link, Link, Link, Link, Link, Link]
    | [Link, Link, Link, Link, Link, Link, Link]
    | [Link, Link, Link, Link, Link, Link, Link, Link]
    | [Link, Link, Link, Link, Link, Link, Link, Link, Link]
    | [Link, Link, Link, Link, Link, Link, Link, Link, Link, Link];
  footerText: string | null;
  contactEmail: string | null;
  donateUrl: string | null;
  analyticsEnabled: boolean;
}
export interface Link {
  label: string;
  href: string;
  icon:
    | (
        | {
            source: "library";
            id: string;
          }
        | {
            source: "media";
            id: string;
          }
      )
    | null;
  newTab: boolean;
}
export interface Presentation {
  width: "full" | "wide" | "narrow";
  align: "start" | "center";
  background:
    | {
        kind: "none";
      }
    | {
        kind: "token";
        token: "surface" | "muted" | "accent" | "night";
      }
    | {
        kind: "media";
        media: MediaRef;
        overlay: number;
      };
  spacing: "tight" | "normal" | "loose";
  iconBefore:
    | (
        | {
            source: "library";
            id: string;
          }
        | {
            source: "media";
            id: string;
          }
      )
    | null;
  iconAfter:
    | (
        | {
            source: "library";
            id: string;
          }
        | {
            source: "media";
            id: string;
          }
      )
    | null;
  anchor: string | null;
}
export interface MediaRef {
  mediaId: string;
  alt: string | null;
}
