// docs/site.md section 7.6. Bottom-right icon-button control column: zoom
// in, zoom out, centre, and (when enabled) snow. Uses the `.ibtn` recipe.

import { copy } from "../../../copy/copy";

export type MapControlsProps = {
  snowOn: boolean;
  showSnow: boolean;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSnowToggle: () => void;
};

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.75",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...strokeProps} aria-hidden>
      <path d="M12 2v20M4.2 6l15.6 12M4.2 18l15.6-12" />
    </svg>
  );
}

export function MapControls({ snowOn, showSnow, onRecenter, onZoomIn, onZoomOut, onSnowToggle }: MapControlsProps) {
  return (
    <div className="map-controls" data-testid="map-controls">
      <button
        type="button"
        className="ibtn map-controls__button map-controls__button--zoom-in"
        aria-label={copy.map.zoomIn}
        onClick={onZoomIn}
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        className="ibtn map-controls__button map-controls__button--zoom-out"
        aria-label={copy.map.zoomOut}
        onClick={onZoomOut}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className="ibtn map-controls__button map-controls__button--recenter"
        aria-label={copy.map.centerOnSanta}
        onClick={onRecenter}
      >
        <TargetIcon />
      </button>
      {showSnow ? (
        <button
          type="button"
          className="ibtn map-controls__button map-controls__button--snow"
          aria-label={copy.map.snow}
          aria-pressed={snowOn}
          onClick={onSnowToggle}
          data-testid="snow-toggle"
        >
          <SnowIcon />
        </button>
      ) : null}
    </div>
  );
}
