// docs/site.md section 7.6. The messages pill in the top-left stack: an
// envelope and the count of `snapshot.event.messages`, absent while there
// are none. Messages with an id above the number stored under
// `wmsfo.messages.seen.<eventId>` are unread (absent means all of them);
// while any is unread a red ornament dot sits at the envelope's top right.
// When the newest id grows while the pill is on screen the envelope shakes
// once (no shake under reduced motion). The pill opens the messages dialog
// only when pressed; opening stores the newest id, so the dot clears, while
// the dialog keeps its New markers until it closes.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentBundle } from "../../../store/types";
import { useStore } from "../../../store/useStore";
import { storageGet, storageSet } from "../../../lib/storage";
import { useReducedMotion } from "../../../lib/motion";
import { copy } from "../../../copy/copy";
import { EnvelopeGlyph } from "./glyphs";
import { MessagesDialog, type EventMessage } from "./MessagesDialog";
import * as styles from "./Map.module.css";

// The shake's length in ms; matches `envelopeShake` in Map.module.css. A
// timer ends it in case `animationend` never fires.
const SHAKE_MS = 600;

const EMPTY: readonly EventMessage[] = [];

function messagesSeenKey(eventId: number | null): string {
  return `wmsfo.messages.seen.${eventId ?? "none"}`;
}

function readSeen(key: string): number | null {
  const raw = storageGet(key);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function MessagesPill({ bundle }: { bundle: ContentBundle }) {
  const eventId = useStore((s) => s.snapshot?.event?.id ?? null);
  const raw = useStore((s) => s.snapshot?.event?.messages ?? EMPTY);
  const reducedMotion = useReducedMotion();
  const messages = useMemo(
    () => raw.filter((m): m is EventMessage & { id: number } => typeof m.id === "number"),
    [raw],
  );
  const key = messagesSeenKey(eventId);
  // Bumped after a write so the render reads the stored mark again.
  const [, setSeenVersion] = useState(0);
  const seenId = readSeen(key);
  // The seen mark held when the dialog opened; undefined while it is closed.
  const [openedWith, setOpenedWith] = useState<{ seenId: number | null } | undefined>(undefined);
  const [shaking, setShaking] = useState(false);

  const newest = messages.reduce<number | null>((max, m) => (max === null || m.id > max ? m.id : max), null);
  const unread = messages.filter((m) => seenId === null || m.id > seenId).length;

  // A rise shakes only an envelope that was already on screen, not one
  // appearing with its first message.
  const lastNewestRef = useRef<number | null>(newest);
  useEffect(() => {
    const prev = lastNewestRef.current;
    lastNewestRef.current = newest;
    if (prev !== null && newest !== null && newest > prev && !reducedMotion) setShaking(true);
  }, [newest, reducedMotion]);

  useEffect(() => {
    if (!shaking) return;
    const t = window.setTimeout(() => setShaking(false), SHAKE_MS + 50);
    return () => window.clearTimeout(t);
  }, [shaking]);

  if (messages.length === 0) return null;

  const shakeClass = shaking && !reducedMotion ? ` ${styles.messagesShake}` : "";

  const open = () => {
    setOpenedWith({ seenId });
    if (newest !== null) {
      storageSet(key, String(newest));
      setSeenVersion((v) => v + 1);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.messagesPill}
        aria-label={copy.map.messages.pill(messages.length, unread)}
        aria-haspopup="dialog"
        data-testid="messages-pill"
        onClick={open}
      >
        <span
          className={`${styles.messagesEnvelope}${shakeClass}`}
          data-testid="messages-envelope"
          onAnimationEnd={() => setShaking(false)}
        >
          <EnvelopeGlyph size={14} />
          {unread > 0 ? (
            <span className={styles.messagesDot} aria-hidden data-testid="messages-dot" />
          ) : null}
        </span>
        <span className={styles.messagesCount} data-testid="messages-count">
          {messages.length}
          <span className={styles.visuallyHidden}> {copy.map.messages.noun(messages.length)}</span>
        </span>
      </button>
      {openedWith !== undefined ? (
        <MessagesDialog
          messages={messages}
          seenId={openedWith.seenId}
          bundle={bundle}
          onClose={() => setOpenedWith(undefined)}
        />
      ) : null}
    </>
  );
}
