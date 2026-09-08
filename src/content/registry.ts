// docs/site.md section 7.2. Registry mapping section and block kinds to
// components. In S3 the section components are placeholders that render
// their heading (when present in data) and the kind name so the page
// renderer, section frame, and content flow can be exercised. Real
// components are S4 through S6.

import type { ComponentType } from "react";
import type { ContentBundle } from "../store/types";

export type SectionComponentProps = {
  data: unknown;
  items: { id: number; data: unknown }[];
  bundle: ContentBundle;
};

export type SectionComponent = ComponentType<SectionComponentProps>;

export type BlockComponentProps = {
  data: unknown;
  bundle: ContentBundle;
};

export type BlockComponent = ComponentType<BlockComponentProps>;

import { Unknown } from "./sections/Unknown";
import { placeholderSection } from "./sections/placeholder";
import { placeholderBlock } from "./sections/placeholderBlock";
import { CookieControl } from "./sections/CookieControl/CookieControl";
import { AlertsSignup } from "./sections/AlertsSignup/AlertsSignup";
import { ContactForm } from "./sections/ContactForm/ContactForm";

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
  cookie_control: CookieControl,
  alerts_signup: AlertsSignup,
  contact_form: ContactForm,
};

const sections: Record<string, SectionComponent> = {};
for (const kind of SECTION_KINDS) {
  sections[kind] = SECTION_OVERRIDES[kind] ?? placeholderSection(kind);
}

const blocks: Record<string, BlockComponent> = {};
for (const kind of BLOCK_KINDS) {
  blocks[kind] = placeholderBlock(kind);
}

export const registry: {
  sections: Record<string, SectionComponent>;
  blocks: Record<string, BlockComponent>;
} = { sections, blocks };

export { Unknown };
export const SECTION_KIND_KEYS: readonly string[] = SECTION_KINDS;
export const BLOCK_KIND_KEYS: readonly string[] = BLOCK_KINDS;
