// docs/site.md section 5.1. React binding through useSyncExternalStore.
// The selector output is memoized against the raw store snapshot and the
// selector itself so derived objects keep a stable identity across renders.
// A selector that closes over a prop (SlugPage reads the route's slug)
// changes identity when the prop changes, and the memo must recompute then
// even though the store did not move; keying on the store alone handed the
// previous slug's page back until the next live poll replaced the state.

import { useCallback, useRef, useSyncExternalStore } from "react";
import { store } from "./store";
import type { SiteStore } from "./types";

type Cache<T> = { state: SiteStore; selector: (s: SiteStore) => T; result: T };

export function useStore<T>(
  selector: (s: SiteStore) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cacheRef = useRef<Cache<T> | null>(null);
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const cache = cacheRef.current;
    if (cache !== null) {
      if (cache.state === state && cache.selector === selector) return cache.result;
      const next = selector(state);
      if (isEqual(cache.result, next)) {
        cache.state = state;
        cache.selector = selector;
        return cache.result;
      }
      cacheRef.current = { state, selector, result: next };
      return next;
    }
    const result = selector(state);
    cacheRef.current = { state, selector, result };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, isEqual]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export { store };
