// docs/site.md sections 7.6 and 8.6. Distance from the visitor to Santa
// on a 34 px pill with the person-pin glyph, as the legacy tracker showed
// it; only when user location is enabled and both fixes exist.

import { formatDistanceMetres } from "../../../map/userLocation";
import { PersonPinGlyph } from "./glyphs";
import * as styles from "./Map.module.css";

export function DistanceChip({ distanceMetres }: { distanceMetres: number | null }) {
  if (distanceMetres === null || !Number.isFinite(distanceMetres)) return null;
  const text = formatDistanceMetres(distanceMetres);
  if (text === "") return null;
  return (
    <div className={styles.distanceChip} role="status" aria-live="polite" data-testid="distance-chip">
      <PersonPinGlyph />
      <span>{text}</span>
    </div>
  );
}
