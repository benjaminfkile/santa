// docs/site.md section 7.1. Loading page rendered until the first live
// object and snapshot arrive.

import { useEffect, useState } from "react";
import { copy } from "../copy/copy";

const SLOW_MS = 15000;

export function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <main id="main">
      <div role="status" aria-live="polite">
        <p>{copy.loading.initial}</p>
        {slow ? <p>{copy.loading.slow}</p> : null}
      </div>
    </main>
  );
}
