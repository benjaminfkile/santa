// docs/site.md section 5.1. Framework-free store bound to React through
// useSyncExternalStore in ./useStore.

import { initialStore, type SiteStore } from "./types";

export type Listener = () => void;

export type StoreHandle = {
  getState: () => SiteStore;
  setState: (patch: Partial<SiteStore> | ((s: SiteStore) => SiteStore)) => void;
  subscribe: (l: Listener) => () => void;
};

export function createStore(initial: SiteStore): StoreHandle {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState(patch) {
      state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const store: StoreHandle = createStore(initialStore);
