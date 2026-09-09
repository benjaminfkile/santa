// docs/site.md section 7.6. Recenter button when not following; zoom in
// and out when following.

export type MapControlsProps = {
  following: boolean;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapControls({ following, onRecenter, onZoomIn, onZoomOut }: MapControlsProps) {
  return (
    <div className="map-controls">
      {following ? (
        <>
          <button
            type="button"
            className="map-controls__button map-controls__button--zoom-in"
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            +
          </button>
          <button
            type="button"
            className="map-controls__button map-controls__button--zoom-out"
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            −
          </button>
        </>
      ) : (
        <button
          type="button"
          className="map-controls__button map-controls__button--recenter"
          onClick={onRecenter}
        >
          Recenter
        </button>
      )}
    </div>
  );
}
