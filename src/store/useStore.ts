// docs/site.md section 5.1. React binding through useSyncExternalStore.
// The selector output is memoized against the raw store snapshot so
// derived objects keep a stable identity across renders.

import { useCallback, useRef, useSyncExternalStore } from "react";
import { store } from "./store";
import type { SiteStore } from "./types";

type Cache<T> = { state: SiteStore; result: T };

export function useStore<T>(
  selector: (s: SiteStore) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cacheRef = useRef<Cache<T> | null>(null);
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const cache = cacheRef.current;
    if (cache !== null) {
      if (cache.state === state) return cache.result;
      const next = selector(state);
      if (isEqual(cache.result, next)) {
        cache.state = state;
        return cache.result;
      }
      cacheRef.current = { state, result: next };
      return next;
    }
    const result = selector(state);
    cacheRef.current = { state, result };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, isEqual]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export { store };
