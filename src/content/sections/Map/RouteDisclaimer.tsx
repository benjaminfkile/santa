// docs/site.md section 7.6. Shown on the first live-screen visit per
// browser; "I understand" stores the localStorage key.

import { useEffect, useRef, useState } from "react";
import { storageGet, storageSet } from "../../../lib/storage";
import * as styles from "../RoutePreview/RoutePreview.module.css";

const KEY = "wmsfo.routeDisclaimerAck";

export function RouteDisclaimer() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState<boolean>(() => storageGet(KEY) === null);

  useEffect(() => {
    if (!open) return;
    const dlg = dialogRef.current;
    if (dlg !== null && typeof dlg.showModal === "function" && !dlg.open) {
      try {
        dlg.showModal();
      } catch {
        // ignore; some jsdom builds do not implement showModal.
      }
    }
  }, [open]);

  if (!open) return null;

  function acknowledge() {
    storageSet(KEY, "1");
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.routeDisclaimer}
      aria-labelledby="route-disclaimer-heading"
      data-testid="route-disclaimer"
    >
      <h2 id="route-disclaimer-heading">About the tracker</h2>
      <p>
        The route shown is a plan and may change. Please stay clear of any moving
        vehicles.
      </p>
      <button type="button" onClick={acknowledge}>
        I understand
      </button>
    </dialog>
  );
}
