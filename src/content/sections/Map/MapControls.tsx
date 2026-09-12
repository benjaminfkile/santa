// docs/site.md section 7.6. Bottom-right controls as the legacy tracker
// had them: zoom in and out stacked in one 44 px column while the map
// follows Santa; a single recenter button once the visitor has dragged.

import { copy } from "../../../copy/copy";
import { MinusGlyph, PlusGlyph, TargetGlyph } from "./glyphs";
import * as styles from "./Map.module.css";

export type MapControlsProps = {
  following: boolean;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapControls({ following, onRecenter, onZoomIn, onZoomOut }: MapControlsProps) {
  return (
    <div className={styles.mapControls} data-testid="map-controls">
      {following ? (
        <div className={styles.zoomGroup}>
          <button type="button" className={styles.ctrl} aria-label={copy.map.zoomIn} onClick={onZoomIn}>
            <PlusGlyph size={22} />
          </button>
          <button type="button" className={styles.ctrl} aria-label={copy.map.zoomOut} onClick={onZoomOut}>
            <MinusGlyph size={22} />
          </button>
        </div>
      ) : (
        <div className={styles.recenter}>
          <button type="button" className={styles.ctrl} aria-label={copy.map.centerOnSanta} onClick={onRecenter} data-testid="map-recenter">
            <TargetGlyph size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
