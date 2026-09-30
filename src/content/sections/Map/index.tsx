// docs/site.md sections 7.4, 7.6, and 18. The `map` section is imported
// through React.lazy so the `map` chunk (Google Maps loader, controller,
// themes) only enters the bundle when a `map` section actually mounts.
// An error boundary wraps the section: a failed chunk load or any throw
// while it renders or runs its effects (the live flip included) shows the
// "map unavailable" panel, and its Retry loads the chunk again and mounts
// the section afresh.

import { Component, Suspense, lazy, useCallback, useState, type ReactNode } from "react";
import type { SectionComponent } from "../../registry";
import { useStore } from "../../../store/useStore";
import { selectTakeover } from "../../selectPage";
import { MapUnavailable } from "./MapUnavailable";
import * as styles from "./Map.module.css";

function lazyMap() {
  return lazy(() =>
    import("./Map").then((mod) => ({ default: mod.Map as SectionComponent })),
  );
}

// One lazy component for every mount; Retry replaces it so a chunk that
// failed to load is requested again.
let LazyMap = lazyMap();

type BoundaryProps = {
  fallback: (retry: () => void) => ReactNode;
  onRetry: () => void;
  children: ReactNode;
};

export class MapErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  retry = (): void => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

export const MapSection: SectionComponent = (props) => {
  const takeover = useStore(selectTakeover);
  const [attempt, setAttempt] = useState(0);
  const sectionClass = [styles.mapSection, takeover ? styles.mapSectionTakeover : ""]
    .filter(Boolean)
    .join(" ");

  const onRetry = useCallback(() => {
    LazyMap = lazyMap();
    setAttempt((n) => n + 1);
  }, []);

  return (
    <MapErrorBoundary
      onRetry={onRetry}
      fallback={(retry) => (
        <div
          className={sectionClass}
          data-testid="map"
          data-takeover={takeover ? "live" : undefined}
        >
          <MapUnavailable onRetry={retry} />
        </div>
      )}
    >
      <Suspense fallback={<div className={`${styles.mapSection} ${styles.mapSectionLoading}`} aria-busy />}>
        <LazyMap key={attempt} {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
};

export default MapSection;
