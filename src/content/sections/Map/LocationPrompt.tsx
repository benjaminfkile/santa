// docs/site.md section 8.6. Disabled state: explains why location is
// asked, warns when inside the FB or IG in-app browser, gives OS-specific
// steps, and offers Enable and Cancel. Enabled state: offers Disable and
// Back. After a PERMISSION_DENIED error the prompt reopens on the
// instructions section.

import { useEffect, useRef } from "react";
import { inAppBrowser } from "../../../lib/inAppBrowser";

export type LocationPromptProps = {
  open: boolean;
  enabled: boolean;
  errorCode: GeolocationPositionError["code"] | null;
  onClose: () => void;
  onEnable: () => void;
  onDisable: () => void;
};

export function LocationPrompt({
  open,
  enabled,
  errorCode,
  onClose,
  onEnable,
  onDisable,
}: LocationPromptProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg === null) return;
    if (open && typeof dlg.showModal === "function" && !dlg.open) {
      try {
        dlg.showModal();
      } catch {
        // ignore
      }
    }
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (!open) return null;

  const wasDenied = errorCode === 1;
  const showDeniedHelp = wasDenied;

  return (
    <dialog
      ref={dialogRef}
      className="location-prompt"
      aria-labelledby="location-prompt-heading"
      data-testid="location-prompt"
    >
      <h2 id="location-prompt-heading">Your location on the map</h2>
      {enabled ? (
        <>
          <p>You are showing your location on the map.</p>
          <div className="location-prompt__actions">
            <button type="button" onClick={onDisable}>Disable</button>
            <button type="button" onClick={onClose}>Back</button>
          </div>
        </>
      ) : (
        <>
          <p>
            We use your device's location to show your distance from Santa. The
            location is used on this page only and never leaves your browser.
          </p>
          {inAppBrowser() ? (
            <p className="location-prompt__inapp">
              You appear to be inside the Facebook or Instagram browser. Location
              may not work there. Try opening this page in your regular browser.
            </p>
          ) : null}
          {showDeniedHelp ? (
            <div className="location-prompt__denied" data-testid="location-denied">
              <h3>Location is blocked</h3>
              <ul>
                <li>
                  <strong>iOS:</strong> Settings &gt; Safari &gt; Location.
                </li>
                <li>
                  <strong>Android:</strong> Site settings &gt; Location.
                </li>
                <li>
                  <strong>Desktop:</strong> click the lock in the address bar and
                  allow Location.
                </li>
              </ul>
            </div>
          ) : null}
          <div className="location-prompt__actions">
            <button type="button" onClick={onEnable}>Enable</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </dialog>
  );
}
