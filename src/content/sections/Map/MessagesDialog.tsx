// docs/site.md section 7.6. The messages dialog on the shared dialog
// recipe: a native <dialog> opened with showModal that closes on a
// backdrop press, Escape, the close X in its head, and the Close button;
// its row sits in the recipe's scroll region. Rendered inside the map
// section, it takes the tokens the section binds to the map style, as the
// cookie dialog does. It shows the event's latest message: the body
// through `Inline` as the `latest_message` section draws it, its time from
// `eventTime` (or `createdAt`), and a New marker while `fresh`, which says
// the message was unread when the dialog opened.

import { useEffect, useRef } from "react";
import type { Snapshot } from "../../../contracts";
import type { ContentBundle } from "../../../store/types";
import { Inline } from "../../inline/Inline";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import { formatEventTime } from "../../../lib/time";
import { copy } from "../../../copy/copy";
import * as dlg from "../../../ui/Dialog.module.css";
import * as btn from "../../../ui/Button.module.css";
import * as ibtn from "../../../ui/IconButton.module.css";
import { CloseGlyph } from "./glyphs";
import * as styles from "./MessagesDialog.module.css";

export type EventMessage = NonNullable<NonNullable<Snapshot["event"]>["latestMessage"]>;

export type MessagesDialogProps = {
  message: EventMessage;
  fresh: boolean;
  bundle: ContentBundle;
  onClose: () => void;
};

export function MessagesDialog({ message, fresh, bundle, onClose }: MessagesDialogProps) {
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

  const close = () => {
    const el = ref.current;
    if (el !== null && typeof el.close === "function" && el.open) el.close();
    onClose();
  };

  const time = formatEventTime(message.eventTime ?? message.createdAt ?? null);

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
          <button
            type="button"
            className={`${ibtn.ibtn} ${dlg.closeX}`}
            aria-label={copy.map.messages.close}
            onClick={close}
            data-testid="messages-dialog-close-x"
          >
            <CloseGlyph size={18} />
          </button>
        </div>
        <div className={dlg.scroll} data-testid="messages-dialog-scroll">
          <div className={styles.row} data-testid="messages-dialog-row">
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
              <Inline text={message.body ?? ""} bundle={bundle} event={event} />
            </p>
          </div>
        </div>
        <div className={dlg.actions}>
          <button type="button" className={btn.btnFill} onClick={close} data-testid="messages-dialog-close">
            {copy.map.messages.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
