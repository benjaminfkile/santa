// docs/site.md section 7.7, Alerts bell. The alerts dialog on the shared
// dialog recipe: a native <dialog> opened with showModal that closes on a
// backdrop press, Escape, and the Close button. It lists the alerts sent
// to the visitor newest first (the time in the viewer's timezone, the
// event name, the subject line, and the kind label of section 13.1), with
// a New marker on each alert whose id is above `seenId`, the seen mark
// held when the dialog opened. The footer carries Manage alerts, linking
// to the page with the alerts form when there is one, and Close.

import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import type { AlertItem } from "../api/subscriptions";
import { copy } from "../copy/copy";
import { formatEventTime } from "../lib/time";
import { alertId } from "./alertId";
import { alertKindLabel } from "./alertKind";
import * as dlg from "../ui/Dialog.module.css";
import * as btn from "../ui/Button.module.css";
import * as styles from "./Alerts.module.css";

export type AlertsDialogProps = {
  alerts: AlertItem[];
  seenId: number | null;
  manageHref: string | null;
  onClose: () => void;
};

export function AlertsDialog({ alerts, seenId, manageHref, onClose }: AlertsDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

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

  const sorted = useMemo(() => {
    const list = alerts.slice();
    list.sort((a, b) => {
      const aa = a.sentAt ?? "";
      const bb = b.sentAt ?? "";
      if (aa !== bb) return aa < bb ? 1 : -1;
      return alertId(b) - alertId(a);
    });
    return list;
  }, [alerts]);

  const close = () => {
    const el = ref.current;
    if (el !== null && typeof el.close === "function" && el.open) el.close();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className={dlg.dialog}
      aria-labelledby="alerts-dialog-title"
      data-testid="alerts-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={dlg.body}>
        <div className={dlg.head}>
          <h2 id="alerts-dialog-title" className={dlg.title}>{copy.alerts.title}</h2>
        </div>
        {sorted.length === 0 ? (
          <p className={dlg.copy} data-testid="alerts-dialog-empty">{copy.alerts.empty}</p>
        ) : (
          <ul className={styles.rows} data-testid="alerts-dialog-list">
            {sorted.map((row) => {
              const id = alertId(row);
              const fresh = seenId === null || id > seenId;
              const label = alertKindLabel(row.kind);
              const update = label === copy.alerts.kindUpdate;
              return (
                <li key={id} className={styles.row} data-testid={`alerts-dialog-row-${id}`}>
                  <div className={styles.rowHead}>
                    <span className={styles.when}>{formatEventTime(row.sentAt)}</span>
                    <span className={`${styles.kind} ${update ? styles.kindUpdate : styles.kindStatus}`}>
                      {label}
                    </span>
                    {fresh ? (
                      <span className={styles.fresh} data-testid="alerts-dialog-new">{copy.alerts.newMarker}</span>
                    ) : null}
                  </div>
                  <div className={styles.event}>{row.eventName ?? ""}</div>
                  <div className={styles.subject}>{row.subject ?? ""}</div>
                </li>
              );
            })}
          </ul>
        )}
        <div className={dlg.actions}>
          {manageHref !== null ? (
            <Link to={manageHref} className={btn.btnQuiet} onClick={close} data-testid="alerts-dialog-manage">
              {copy.alerts.manage}
            </Link>
          ) : null}
          <button type="button" className={btn.btnFill} onClick={close} data-testid="alerts-dialog-close">
            {copy.alerts.close}
          </button>
        </div>
      </div>
    </dialog>
  );
}
