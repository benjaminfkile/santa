// docs/site.md section 7.6. The messages dialog on the shared dialog
// recipe: a native <dialog> opened with showModal that closes on a
// backdrop press, Escape, and the Close button. Rendered inside the map
// section, it takes the tokens the section binds to the map style, as the
// cookie dialog does. It lists the event's messages newest first, each
// body through `Inline` as the `latest_message` section draws it, its time
// from `eventTime` (or `createdAt`), and a New marker on each message whose
// id is above `seenId`, the seen mark held when the dialog opened.

import { useEffect, useMemo, useRef } from "react";
import type { Snapshot } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { formatEventTime } from "../../../lib/time";
import { copy } from "../../../copy/copy";
import * as dlg from "../../../ui/Dialog.module.css";
import * as btn from "../../../ui/Button.module.css";
import * as styles from "./MessagesDialog.module.css";

export type EventMessage = NonNullable<Snapshot["event"]>["messages"][number];

export type MessagesDialogProps = {
  messages: readonly (EventMessage & { id: number })[];
  seenId: number | null;
  bundle: ContentBundle;
  onClose: () => void;
};

export function MessagesDialog({ messages, seenId, bundle, onClose }: MessagesDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const event = useSnapshotEvent();

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof el.showModal === "function" && !el.open) {
      try {
        el.showModal();
      } catch {
        // ignore; some jsdom builds do not implement showModal.
      }
    }
  }, []);

  const sorted = useMemo(() => messages.slice().sort((a, b) => b.id - a.id), [messages]);

  const close = () => {
    const el = ref.current;
    if (el !== null && typeof el.close === "function" && el.open) el.close();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className={dlg.dialog}
      aria-labelledby="messages-dialog-title"
      data-testid="messages-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={dlg.body}>
        <div className={dlg.head}>
          <h2 id="messages-dialog-title" className={dlg.title}>{copy.map.messages.title}</h2>
        </div>
        <ul className={styles.rows} data-testid="messages-dialog-list">
          {sorted.map((m) => {
            const fresh = seenId === null || m.id > seenId;
            const time = formatEventTime(m.eventTime ?? m.createdAt ?? null);
            return (
              <li key={m.id} className={styles.row} data-testid={`messages-dialog-row-${m.id}`}>
                {time !== "" || fresh ? (
                  <div className={styles.rowHead}>
                    {time !== "" ? (
                      <span className={styles.when} data-testid="messages-dialog-time">{time}</span>
                    ) : null}
                    {fresh ? (
                      <span className={styles.fresh} data-testid="messages-dialog-new">
                        {copy.map.messages.newMarker}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <p className={styles.body}>
                  <Inline text={m.body ?? ""} bundle={bundle} event={event} />
                </p>
              </li>
            );
          })}
        </ul>
        <div className={dlg.actions}>
          <button type="button" className={btn.btnFill} onClick={close} data-testid="messages-dialog-close">
            {copy.map.messages.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
