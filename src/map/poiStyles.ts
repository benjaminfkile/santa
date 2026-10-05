// docs/site.md sections 8.2 and 8.4. The tracker's place filter: the map
// section's `poiKinds` are the Google-supplied place kinds the map shows
// while `poiFilter` is on. `POI_KINDS` mirrors `PoiKind` in
// contracts/schema/sections/map.schema.json, and `poiStyles` turns a theme's
// style array and a filter into the array the map is given.

export const POI_KINDS = [
  "attraction",
  "business",
  "government",
  "medical",
  "park",
  "place_of_worship",
  "school",
  "sports_complex",
  "transit",
] as const;

export type PoiKind = (typeof POI_KINDS)[number];

export type PoiFilter = { kinds: readonly string[] } | null;

// The known kinds in `list`, unknown strings dropped and duplicates removed,
// in the order given.
export function resolvePoiKinds(list: unknown): PoiKind[] {
  if (!Array.isArray(list)) return [];
  const out: PoiKind[] = [];
  for (const k of list) {
    if ((POI_KINDS as readonly unknown[]).includes(k) && !out.includes(k as PoiKind)) {
      out.push(k as PoiKind);
    }
  }
  return out;
}

// The Google feature type a kind hides: `poi.<kind>`, except `transit`.
function featureType(kind: PoiKind): string {
  return kind === "transit" ? "transit" : `poi.${kind}`;
}

// The theme's styles unchanged, then one visibility-off rule for every kind
// the filter leaves out. With no filter the theme's array is returned itself.
export function poiStyles(
  themeStyles: google.maps.MapTypeStyle[],
  filter: PoiFilter,
): google.maps.MapTypeStyle[] {
  if (filter === null) return themeStyles;
  const hidden = POI_KINDS.filter((k) => !filter.kinds.includes(k));
  return [
    ...themeStyles,
    ...hidden.map((k) => ({ featureType: featureType(k), stylers: [{ visibility: "off" }] })),
  ];
}
