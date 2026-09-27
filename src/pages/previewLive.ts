// docs/site.md section 7.8. The live state of the preview poll, read by the
// Preview banner: when the last change was applied and whether five or
// more polls in a row have failed. The PreviewSession component writes it;
// ending or expiring the session resets it.

import { useSyncExternalStore } from "react";

export type PreviewLiveState = {
  lastChangeAt: number | null;
  reconnecting: boolean;
};

const initial: PreviewLiveState = { lastChangeAt: null, reconnecting: false };

let state: PreviewLiveState = initial;
const listeners = new Set<() => void>();

export function getPreviewLive(): PreviewLiveState {
  return state;
}

export function setPreviewLive(patch: Partial<PreviewLiveState>): void {
  const next = { ...state, ...patch };
  if (next.lastChangeAt === state.lastChangeAt && next.reconnecting === state.reconnecting) return;
  state = next;
  listeners.forEach((l) => l());
}

export function resetPreviewLive(): void {
  setPreviewLive(initial);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePreviewLive(): PreviewLiveState {
  return useSyncExternalStore(subscribe, getPreviewLive, getPreviewLive);
}
