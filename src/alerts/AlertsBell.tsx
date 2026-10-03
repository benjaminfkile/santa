// docs/site.md section 7.7, Alerts bell. The header's alerts button,
// shown only while signed in and when the visitor holds an active
// subscription or has been sent an alert. A sleigh bell glyph with a red
// ornament badge counting the unread alerts ("9+" past nine); the bell
// swings once when the count rises while it is on screen (no swing under
// reduced motion). It opens the alerts dialog only when pressed; opening
// marks every alert seen, so the badge clears, while the dialog keeps its
// New markers until it closes.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../store/useStore";
import { selectBundle, selectRole } from "../content/selectPage";
import { alertsPageHref } from "../content/nav";
import { useReducedMotion } from "../lib/motion";
import { copy } from "../copy/copy";
import { useAlerts } from "./AlertsProvider";
import { AlertsDialog } from "./AlertsDialog";
import * as styles from "./Alerts.module.css";

// The swing's length in ms; matches `bellSwing` in Alerts.module.css. A
// timer ends it in case `animationend` never fires.
const SWING_MS = 700;

export function AlertsBell({ className }: { className?: string }) {
  const { state: auth } = useAuth();
  const { alerts, subscribed, unreadCount, seenId, markSeen } = useAlerts();
  const reducedMotion = useReducedMotion();
  const homeRole = useStore(selectRole);
  const manageHref = useStore((s) => {
    const content = selectBundle(s)?.content ?? null;
    return content === null ? null : alertsPageHref(content, homeRole);
  });
  // The seen mark held when the dialog opened; null while it is closed.
  const [openedWith, setOpenedWith] = useState<{ seenId: number | null } | null>(null);
  const [swinging, setSwinging] = useState(false);
  const visible = auth.status === "signedIn" && (subscribed || alerts.length > 0);
  // The count and visibility the bell last rendered with: a rise swings
  // only a bell that was already on screen, not one appearing with it.
  const lastRef = useRef({ count: unreadCount, visible });

  useEffect(() => {
    const last = lastRef.current;
    const rose = last.visible && visible && unreadCount > last.count;
    lastRef.current = { count: unreadCount, visible };
    if (rose && !reducedMotion) setSwinging(true);
  }, [unreadCount, visible, reducedMotion]);

  useEffect(() => {
    if (!swinging) return;
    const t = window.setTimeout(() => setSwinging(false), SWING_MS + 50);
    return () => window.clearTimeout(t);
  }, [swinging]);

  if (!visible) return null;

  const label = unreadCount > 0 ? copy.alerts.bellNew(unreadCount) : copy.alerts.bell;
  const swingClass = swinging && !reducedMotion ? ` ${styles.swing}` : "";

  return (
    <>
      <button
        type="button"
        className={`${className ?? ""} ${styles.bell}`.trim()}
        aria-label={label}
        aria-haspopup="dialog"
        data-testid="alerts-bell"
        onClick={() => {
          setOpenedWith({ seenId });
          markSeen();
        }}
      >
        <span
          className={`${styles.bellBody}${swingClass}`}
          data-testid="alerts-bell-body"
          onAnimationEnd={() => setSwinging(false)}
        >
          <SleighBellGlyph />
          {unreadCount > 0 ? (
            <span className={styles.badge} aria-hidden data-testid="alerts-badge">
              {copy.alerts.badge(unreadCount)}
            </span>
          ) : null}
        </span>
      </button>
      {openedWith !== null ? (
        <AlertsDialog
          alerts={alerts}
          seenId={openedWith.seenId}
          manageHref={manageHref}
          onClose={() => setOpenedWith(null)}
        />
      ) : null}
    </>
  );
}

// A sleigh bell: the round bell with its slot, a small bow at the top.
// The house stroke (24 px grid, 1.75 px, round caps and joins) in
// currentColor, drawn at 20 px.
export function SleighBellGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <circle cx="12" cy="14.5" r="7" />
      <path d="M8 16.5h8" />
      <circle cx="12" cy="12" r="1" />
      <path d="M12 7.5C10.2 4.6 7.2 4.8 7.8 6.6C8.3 7.8 10.4 7.8 12 7.5Z" />
      <path d="M12 7.5C13.8 4.6 16.8 4.8 16.2 6.6C15.7 7.8 13.6 7.8 12 7.5Z" />
    </svg>
  );
}
