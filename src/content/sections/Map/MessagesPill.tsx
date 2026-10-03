// docs/site.md section 7.6. The messages pill in the top-left stack: an
// envelope for `snapshot.event.latestMessage`, absent while it is null.
// The message is unread while its id is above the read mark kept by
// lib/messageSeen (absent means unread); while unread a red ornament dot
// sits at the envelope's top right. The pill follows the mark through
// `subscribeMessageSeen`, so a `latest_message` section on the same page
// that marks the message read clears the dot. When the message id rises
// while the pill is on screen the envelope shakes once (no shake under
// reduced motion). The pill opens the messages dialog only when pressed;
// opening marks the message read, so the dot clears, while the dialog
// keeps its New marker until it closes.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ContentBundle } from "../../../store/types";
import { useStore } from "../../../store/useStore";
import { markMessageSeen, readSeenMessageId, subscribeMessageSeen } from "../../../lib/messageSeen";
import { useReducedMotion } from "../../../lib/motion";
import { copy } from "../../../copy/copy";
import { EnvelopeGlyph } from "./glyphs";
import { MessagesDialog } from "./MessagesDialog";
import * as styles from "./Map.module.css";

// The shake's length in ms; matches `envelopeShake` in Map.module.css. A
// timer ends it in case `animationend` never fires.
const SHAKE_MS = 600;

export function MessagesPill({ bundle }: { bundle: ContentBundle }) {
  const eventId = useStore((s) => s.snapshot?.event?.id ?? null);
  const raw = useStore((s) => s.snapshot?.event?.latestMessage ?? null);
  const reducedMotion = useReducedMotion();
  const message = raw !== null && typeof raw.id === "number" ? { ...raw, id: raw.id } : null;
  const messageId = message?.id ?? null;
  const readSeen = useCallback(() => (eventId === null ? null : readSeenMessageId(eventId)), [eventId]);
  const seenId = useSyncExternalStore(subscribeMessageSeen, readSeen, readSeen);
  // Whether the message was unread when the dialog opened; undefined while
  // it is closed.
  const [openedWith, setOpenedWith] = useState<{ unread: boolean } | undefined>(undefined);
  const [shaking, setShaking] = useState(false);

  const unread = messageId !== null && (seenId === null || messageId > seenId);

  // A rise shakes only an envelope that was already on screen, not one
  // appearing with its first message.
  const lastIdRef = useRef<number | null>(messageId);
  useEffect(() => {
    const prev = lastIdRef.current;
    lastIdRef.current = messageId;
    if (prev !== null && messageId !== null && messageId > prev && !reducedMotion) setShaking(true);
  }, [messageId, reducedMotion]);

  useEffect(() => {
    if (!shaking) return;
    const t = window.setTimeout(() => setShaking(false), SHAKE_MS + 50);
    return () => window.clearTimeout(t);
  }, [shaking]);

  if (message === null) return null;

  const shakeClass = shaking && !reducedMotion ? ` ${styles.messagesShake}` : "";

  const open = () => {
    setOpenedWith({ unread });
    if (eventId !== null) markMessageSeen(eventId, message.id);
  };

  return (
    <>
      <button
        type="button"
        className={styles.messagesPill}
        aria-label={unread ? copy.map.messages.labelUnread : copy.map.messages.label}
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
          {unread ? (
            <span className={styles.messagesDot} aria-hidden data-testid="messages-dot" />
          ) : null}
        </span>
      </button>
      {openedWith !== undefined ? (
        <MessagesDialog
          message={message}
          fresh={openedWith.unread}
          bundle={bundle}
          onClose={() => setOpenedWith(undefined)}
        />
      ) : null}
    </>
  );
}
