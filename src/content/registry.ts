// docs/site.md section 7.2. Registry mapping section and block kinds to
// components. This is the only wiring point.

import type { ComponentType } from "react";
import type { ContentBundle } from "../store/types";
import type { FrameWidth } from "./primitives/Media";

export type SectionComponentProps = {
  data: unknown;
  items: { id: number; data: unknown }[];
  bundle: ContentBundle;
  frame?: FrameWidth;
};

export type SectionComponent = ComponentType<SectionComponentProps>;

export type BlockComponentProps = {
  data: unknown;
  bundle: ContentBundle;
  frame?: FrameWidth;
};

export type BlockComponent = ComponentType<BlockComponentProps>;

import { Unknown } from "./sections/Unknown";
import { CookieControl } from "./sections/CookieControl/CookieControl";
import { AlertsSignup } from "./sections/AlertsSignup/AlertsSignup";
import { ContactForm } from "./sections/ContactForm/ContactForm";
import { RichText } from "./sections/RichText/RichText";
import { Hero } from "./sections/Hero/Hero";
import { MediaGallery } from "./sections/MediaGallery/MediaGallery";
import { Links } from "./sections/Links/Links";
import { IconRow } from "./sections/IconRow/IconRow";
import { Divider } from "./sections/Divider/Divider";
import { FundsRing } from "./sections/FundsRing/FundsRing";
import { Countdown } from "./sections/Countdown/Countdown";
import { EventTimes } from "./sections/EventTimes/EventTimes";
import { LatestMessage } from "./sections/LatestMessage/LatestMessage";
import { Leaderboard } from "./sections/Leaderboard/Leaderboard";
import { SponsorCarousel } from "./sections/SponsorCarousel/SponsorCarousel";
import { SponsorGrid } from "./sections/SponsorGrid/SponsorGrid";
import { RoutePreview } from "./sections/RoutePreview/RoutePreview";
import { MapSection } from "./sections/Map";
import { HeadingBlock } from "./blocks/HeadingBlock";
import { ParagraphBlock } from "./blocks/ParagraphBlock";
import { ListBlock } from "./blocks/ListBlock";
import { QuoteBlock } from "./blocks/QuoteBlock";
import { MediaBlock } from "./blocks/MediaBlock";
import { LinksBlock } from "./blocks/LinksBlock";
import { IconBlock } from "./blocks/IconBlock";
import { DividerBlock } from "./blocks/DividerBlock";

const SECTION_KINDS = [
  "rich_text",
  "hero",
  "media",
  "links",
  "icon_row",
  "divider",
  "funds_ring",
  "countdown",
  "event_times",
  "latest_message",
  "map",
  "leaderboard",
  "sponsor_carousel",
  "sponsor_grid",
  "route_preview",
  "cookie_control",
  "alerts_signup",
  "contact_form",
] as const;

const BLOCK_KINDS = [
  "heading",
  "paragraph",
  "list",
  "quote",
  "media",
  "links",
  "icon",
  "divider",
] as const;

const SECTION_OVERRIDES: Record<string, SectionComponent> = {
  rich_text: RichText,
  hero: Hero,
  media: MediaGallery,
  links: Links,
  icon_row: IconRow,
  divider: Divider,
  cookie_control: CookieControl,
  alerts_signup: AlertsSignup,
  contact_form: ContactForm,
  funds_ring: FundsRing,
  countdown: Countdown,
  event_times: EventTimes,
  latest_message: LatestMessage,
  leaderboard: Leaderboard,
  sponsor_carousel: SponsorCarousel,
  sponsor_grid: SponsorGrid,
  route_preview: RoutePreview,
  map: MapSection,
};

const sections: Record<string, SectionComponent> = {};
for (const kind of SECTION_KINDS) {
  const impl = SECTION_OVERRIDES[kind];
  if (impl) sections[kind] = impl;
}

const blocks: Record<string, BlockComponent> = {
  heading: HeadingBlock,
  paragraph: ParagraphBlock,
  list: ListBlock,
  quote: QuoteBlock,
  media: MediaBlock,
  links: LinksBlock,
  icon: IconBlock,
  divider: DividerBlock,
};

export const registry: {
  sections: Record<string, SectionComponent>;
  blocks: Record<string, BlockComponent>;
} = { sections, blocks };

export { Unknown };
export const SECTION_KIND_KEYS: readonly string[] = SECTION_KINDS;
export const BLOCK_KIND_KEYS: readonly string[] = BLOCK_KINDS;
