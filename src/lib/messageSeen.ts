// docs/site.md sections 7.4 and 7.6. The read mark of an event's latest
// message: the highest message id the viewer has read, stored under
// `wmsfo.messages.seen.<eventId>`. The tracker's envelope pill and the
// `latest_message` section both write it here; in-page listeners hear every
// rise, so a pill clears its dot when a section on the same page marks the
// message read.

import { storageGet, storageSet } from "./storage";

type Listener = () => void;

const listeners = new Set<Listener>();

export function messageSeenKey(eventId: number): string {
  return `wmsfo.messages.seen.${eventId}`;
}

export function readSeenMessageId(eventId: number): number | null {
  const raw = storageGet(messageSeenKey(eventId));
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Stores `messageId` as read unless the stored id is already that high, then
// tells every listener.
export function markMessageSeen(eventId: number, messageId: number): void {
  const seen = readSeenMessageId(eventId);
  if (seen !== null && seen >= messageId) return;
  storageSet(messageSeenKey(eventId), String(messageId));
  for (const listener of [...listeners]) listener();
}

export function subscribeMessageSeen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
