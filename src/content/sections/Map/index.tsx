// docs/site.md sections 7.4 and 18. The `map` section is imported through
// React.lazy so the `map` chunk (Google Maps loader, controller, themes)
// only enters the bundle when a `map` section actually mounts.

import { Suspense, lazy } from "react";
import type { SectionComponent } from "../../registry";
import * as styles from "./Map.module.css";

const LazyMap = lazy(() =>
  import("./Map").then((mod) => ({ default: mod.Map as SectionComponent })),
);

export const MapSection: SectionComponent = (props) => {
  return (
    <Suspense fallback={<div className={`${styles.mapSection} ${styles.mapSectionLoading}`} aria-busy />}>
      <LazyMap {...props} />
    </Suspense>
  );
};

export default MapSection;
