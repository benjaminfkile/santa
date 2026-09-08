// docs/site.md section 5.1. React binding through useSyncExternalStore.

import { useSyncExternalStore } from "react";
import { store } from "./store";
import type { SiteStore } from "./types";

export function useStore<T>(selector: (s: SiteStore) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export { store };
