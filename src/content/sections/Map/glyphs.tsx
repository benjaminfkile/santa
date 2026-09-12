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
export const FitGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Glyph>
);
export const SpeedGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.5" /></Glyph>
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
export const ChevronGlyph = (p: GlyphProps) => <Glyph {...p}><path d="M6 9l6 6 6-6" /></Glyph>;
export const CookieGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4.5-4A4 4 0 0 1 12 3z" /><circle cx="9" cy="10" r="0.6" /><circle cx="14" cy="15" r="0.6" /><circle cx="8.5" cy="15" r="0.6" /></Glyph>
);
export const SignalGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" /><circle cx="12" cy="19" r="1" /></Glyph>
);
export const TrackerMenuGlyph = (p: GlyphProps) => (
  <Glyph {...p}><path d="M4 7h10M4 12h4M12 12h8M4 17h10M18 17h2" /><circle cx="17" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="17" r="2" /></Glyph>
);
