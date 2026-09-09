// docs/site.md section 7.5. Small selector used by every block that
// renders inline text: returns the current snapshot event fields (or null)
// so `{event:name}` placeholders resolve.

import type { Snapshot } from "../../contracts";
import { useStore } from "../../store/useStore";

type EventFields = NonNullable<Snapshot["event"]>;

export function useSnapshotEvent(): EventFields | null {
  return useStore((s) => s.snapshot?.event ?? null);
}
