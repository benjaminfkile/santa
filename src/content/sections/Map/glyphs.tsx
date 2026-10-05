// docs/site.md section 7.6. The live screen's glyphs, drawn on the icon
// rule (24 px grid, 1.75 px stroke, round caps and joins, currentColor)
// so every control and pill takes its colour from the tokens.

import type { SVGProps } from "react";

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 18, children, ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CloseGlyph = (p: GlyphProps) => <Glyph {...p}><path d="M6 6l12 12M18 6L6 18" /></Glyph>;
export const PlusGlyph = (p: GlyphProps) => <Glyph {...p}><path d="M12 5v14M5 12h14" /></Glyph>;
export const MinusGlyph = (p: GlyphProps) => <Glyph {...p}><path d="M5 12h14" /></Glyph>;
export const TargetGlyph = (p: GlyphProps) => (
  <Glyph {...p}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Glyph>
);
export const TerrainGlyph = (p: GlyphProps) => <Glyph {...p}><path d="M3 19l6-10 4 6 2-3 6 7H3z" /></Glyph>;
export const RoadGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14M15 6v14" /></Glyph>
);
export const SnowGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5" /></Glyph>
);
export const LocationGlyph = (p: GlyphProps) => (
  <Glyph {...p}><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="1.5" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></Glyph>
);
export const HistoryGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></Glyph>
);
export const TimesGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M7 3h10M7 21h10M8 3c0 5 4 6 4 9s-4 4-4 9M16 3c0 5-4 6-4 9s4 4 4 9" /></Glyph>
);
// A flag on a pole over a ground line.
export const LandmarkGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M6 21V4M6 4h11l-2.5 4L17 12H6M3 21h8" /></Glyph>
);
// A route: two stops joined by a winding path, for the Route toggle. The
// history clock it replaced said "the past", not "the way round".
export const RouteGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19h6a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h6" />
  </Glyph>
);
// Binoculars, the map convention for a lookout, for the Viewpoints toggle.
export const ViewpointGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="6.5" cy="15" r="4" />
    <circle cx="17.5" cy="15" r="4" />
    <path d="M10.5 15h3" />
    <path d="M6 11V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
    <path d="M18 11V6a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v5" />
  </Glyph>
);
export const FitGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Glyph>
);
export const SpeedGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.5" /></Glyph>
);
// A dial: an open arc with ticks and a needle from its hub.
export const GaugeGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M3.5 17a8.5 8.5 0 0 1 17 0" /><path d="M6 10.5l1 1M12 8v1.5M18 10.5l-1 1" /><path d="M12 17l3.5-4.5" /><circle cx="12" cy="17" r="1.25" /></Glyph>
);
export const CompassGlyph = (p: GlyphProps) => (
  <Glyph {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Glyph>
);
export const AltitudeGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M12 20V6M7 11l5-5 5 5M4 20h16" /></Glyph>
);
export const AccuracyGlyph = (p: GlyphProps) => (
  <Glyph {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></Glyph>
);
export const PersonPinGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2" /><path d="M8.5 15a4 4 0 0 1 7 0" /></Glyph>
);
export const TakeoffGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M3 20h18M3 13l4 1 11-5a2 2 0 0 0-1.5-3.5L13 7l-5-2-2 1 3.5 2.5-4 1.5-2.5-1.5z" /></Glyph>
);
export const ClockGlyph = (p: GlyphProps) => (
  <Glyph {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Glyph>
);
export const InboxGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M12 3v11M8 10l4 4 4-4M4 15v4h16v-4" /></Glyph>
);
// An envelope with its flap folded down: the event's messages.
export const EnvelopeGlyph = (p: GlyphProps) => (
  <Glyph {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6.5L20.5 7" /></Glyph>
);
export const ChevronGlyph = (p: GlyphProps) => <Glyph {...p}><path d="M6 9l6 6 6-6" /></Glyph>;
export const CookieGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4.5-4A4 4 0 0 1 12 3z" /><circle cx="9" cy="10" r="0.6" /><circle cx="14" cy="15" r="0.6" /><circle cx="8.5" cy="15" r="0.6" /></Glyph>
);
// The cookie with a small plus at its upper right: leave a cookie.
export const CookiePlusGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M11 4a8 8 0 1 0 9 9 3.5 3.5 0 0 1-4-3.5A3.5 3.5 0 0 1 11 4z" /><circle cx="8.5" cy="11" r="0.6" /><circle cx="13" cy="16" r="0.6" /><circle cx="8" cy="16" r="0.6" /><path d="M19 2v6M16 5h6" /></Glyph>
);
export const SignalGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" /><circle cx="12" cy="19" r="1" /></Glyph>
);
export const TrackerMenuGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 7h10M4 12h4M12 12h8M4 17h10M18 17h2" /><circle cx="17" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="17" r="2" /></Glyph>
);
export const EyeGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Glyph>
);
// A name tag with its hole and string: sign in.
export const SignInGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 13l7-9h9v9l-9 9z" /><circle cx="16" cy="8" r="1.3" /><path d="M8 14l5 5M16 8q3-4 5-6" /></Glyph>
);
// A mitten with its cuff: sign out.
export const SignOutGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M8 20V8q0-4 4-4 5 0 5 5v5h-3q0 3 3 4v2z" /><path d="M8 17h9" /></Glyph>
);
