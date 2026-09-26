// docs/site.md section 7.2. A section has a card unless it is a `map` or
// its `presentation.card` is false; absent or null means carded.

import type { Presentation } from "../contracts";

export function hasSectionCard(kind: string, presentation: Presentation): boolean {
  return kind !== "map" && presentation.card !== false;
}
