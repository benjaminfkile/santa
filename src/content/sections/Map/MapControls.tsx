// docs/site.md section 7.6. Bottom-right controls as the legacy tracker
// had them: zoom in and out stacked in one 44 px column while the map
// follows Santa; a single recenter button once the visitor has dragged.
// While the map is turned off north (`rotated`) a north-up button sits at
// the top of the column, its compass needle turned so that it points
// north on the map (`bearing`).

import { copy } from "../../../copy/copy";
import { CompassNeedleGlyph, MinusGlyph, PlusGlyph, TargetGlyph } from "./glyphs";
import * as styles from "./Map.module.css";

export type MapControlsProps = {
  following: boolean;
  rotated?: boolean;
  bearing?: number;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onNorthUp?: () => void;
};

export function MapControls({
  following,
  rotated = false,
  bearing = 0,
  onRecenter,
  onZoomIn,
  onZoomOut,
  onNorthUp,
}: MapControlsProps) {
  return (
    <div className={styles.mapControls} data-testid="map-controls">
      {rotated ? (
        <div className={styles.northUp}>
          <button
            type="button"
            className={styles.ctrl}
            aria-label={copy.map.northUp}
            onClick={onNorthUp}
            data-testid="map-north-up"
          >
            <CompassNeedleGlyph size={22} style={{ transform: `rotate(${-bearing}deg)` }} />
          </button>
        </div>
      ) : null}
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
