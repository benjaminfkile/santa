// docs/site.md sections 7.4, 7.6, 8.1, and 18. The `map` section is
// imported through React.lazy so the `map` chunk (Google Maps loader,
// controller, themes) only enters the bundle when a `map` section actually
// mounts. An error boundary wraps the section: a failed chunk load or any
// throw while it renders or runs its effects (the live flip included) is
// reported as a `map_error` with the source "render" and shows the "map
// unavailable" panel with the reason. The browser keeps a failed dynamic
// import for the life of the page, so the panel's only action is a reload.

import { Component, Suspense, lazy, type ReactNode } from "react";
import type { SectionComponent } from "../../registry";
import { useStore } from "../../../store/useStore";
import { selectTakeover } from "../../selectPage";
import { describeError, reportMapError } from "../../../lib/analytics";
import { MapUnavailable } from "./MapUnavailable";
import * as styles from "./Map.module.css";

const LazyMap = lazy(() =>
  import("./Map").then((mod) => ({ default: mod.Map as SectionComponent })),
);

type BoundaryProps = {
  fallback: (reason: string) => ReactNode;
  children: ReactNode;
};

type BoundaryState = { reason: string | null };

export class MapErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { reason: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { reason: describeError(error) };
  }

  componentDidCatch(error: unknown): void {
    reportMapError("render", error);
  }

  render(): ReactNode {
    return this.state.reason !== null ? this.props.fallback(this.state.reason) : this.props.children;
  }
}

export const MapSection: SectionComponent = (props) => {
  const takeover = useStore(selectTakeover);
  const sectionClass = [styles.mapSection, takeover ? styles.mapSectionTakeover : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <MapErrorBoundary
      fallback={(reason) => (
        <div
          className={sectionClass}
          data-testid="map"
          data-takeover={takeover ? "live" : undefined}
        >
          <MapUnavailable reason={reason} />
        </div>
      )}
    >
      <Suspense fallback={<div className={`${styles.mapSection} ${styles.mapSectionLoading}`} aria-busy />}>
        <LazyMap {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
};

export default MapSection;
