// docs/site.md sections 7.3 and 7.4. The pixel sizes behind the `iconSize`
// settings: the hero icon (`hero.data.iconSize`) and the decorative icons
// before and after a section (`presentation.iconSize`). An absent or null
// setting reads as "sm".

export type IconSize = "sm" | "md" | "lg" | "xl";

export const HERO_ICON_SIZES: Record<IconSize, number> = { sm: 56, md: 96, lg: 144, xl: 200 };

export const SECTION_ICON_SIZES: Record<IconSize, number> = { sm: 24, md: 48, lg: 72, xl: 96 };

export function iconSizeKey(value: unknown): IconSize {
  return value === "md" || value === "lg" || value === "xl" ? value : "sm";
}
