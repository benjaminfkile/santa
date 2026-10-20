// docs/site.md section 13.1. Signed-in: makes no API call on mount. Shows
// `data.copy`, the account line from the id token's email (`useAuth()`),
// the one subscription from the subscription flag as a row (address,
// state, Resend confirmation while pending, Unsubscribe), or the subscribe
// form when there is no flag (prefilled with the account email), and the
// alerts list from the snapshot (`snapshot.event.alerts`, newest first,
// each with its message under the subject when it carries one). While
// `snapshot.subscriptionsOpen` is false, or after a `409
// subscriptions_closed`, the closed copy stands in place of the form and
// of Resend; Unsubscribe stays on an existing flag. Signed-out:
// signedOutCopy plus a sign-in link.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SectionComponent } from "../../registry";
import type { ContentBundle } from "../../../store/types";
import type { SnapshotAlert } from "../../../contracts";
import { useAuth } from "../../../auth/AuthProvider";
import { Inline } from "../../inline/Inline";
import {
  createSubscription,
  deleteSubscription,
  resendVerification,
} from "../../../api/subscriptions";
import { ApiRequestError, surfaceFor } from "../../../api/errors";
import { SignInRequired } from "../../../auth/getIdToken";
import { StatusPill } from "../../primitives/StatusPill";
import { formatEventTime } from "../../../lib/time";
import { useStore } from "../../../store/useStore";
import { selectAlerts } from "../../../alerts/AlertsProvider";
import { useSubscription } from "../../../alerts/SubscriptionProvider";
import { flagFromRow, type SubscriptionFlag } from "../../../alerts/subscriptionFlag";
import { alertKindLabel } from "../../../alerts/alertKind";
import { sortAlerts } from "../../../alerts/sortAlerts";
import { copy } from "../../../copy/copy";
import * as styles from "./AlertsSignup.module.css";
import * as btn from "../../../ui/Button.module.css";
import * as field from "../../../ui/Field.module.css";

export type AlertsSignupData = {
  heading?: string | null;
  copy?: string | null;
  signedOutCopy?: string | null;
};

function readData(data: unknown): AlertsSignupData {
  if (data === null || typeof data !== "object") return {};
  const d = data as AlertsSignupData;
  return {
    heading: d.heading ?? null,
    copy: d.copy ?? null,
    signedOutCopy: d.signedOutCopy ?? null,
  };
}

export const AlertsSignup: SectionComponent = ({ data, bundle }) => {
  const d = readData(data);
  const { state: auth, signIn } = useAuth();
  const location = useLocation();
  const onSignIn = () => void signIn(location.pathname + location.search);

  if (auth.status === "unknown") {
    return (
      <div className={`${styles.alertsSignup} ${styles.alertsSignupPending}`} data-testid="alerts-pending" />
    );
  }
  if (auth.status !== "signedIn") {
    return <SignedOut data={d} bundle={bundle} onSignIn={onSignIn} />;
  }
  return <SignedIn data={d} bundle={bundle} email={auth.email} onSignIn={onSignIn} />;
};

function SignedOut({
  data,
  bundle,
  onSignIn,
}: {
  data: AlertsSignupData;
  bundle: ContentBundle;
  onSignIn: () => void;
}) {
  return (
    <div className={styles.alertsSignup}>
      {data.heading ? <h2>{data.heading}</h2> : null}
      <p><Inline text={data.signedOutCopy ?? ""} bundle={bundle} /></p>
      <button type="button" className={btn.btn} onClick={onSignIn}>Sign in</button>
    </div>
  );
}

function SignedIn({
  data,
  bundle,
  email,
  onSignIn,
}: {
  data: AlertsSignupData;
  bundle: ContentBundle;
  email: string;
  onSignIn: () => void;
}) {
  const { flag: anyFlag, setFlag, clearFlag } = useSubscription();
  const alerts = useStore(selectAlerts);
  const subscriptionsOpen = useStore((s) => s.snapshot?.subscriptionsOpen !== false);
  // A flag of another account is never shown; the provider clears it.
  const flag = anyFlag !== null && anyFlag.account === email ? anyFlag : null;
  const [formAddress, setFormAddress] = useState(email);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [closedByApi, setClosedByApi] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const closed = !subscriptionsOpen || closedByApi;

  useEffect(() => {
    if (cooldownUntil === null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  // The handling shared by every action: true when the error was one of
  // the common cases and has been rendered.
  const handleCommon = useCallback((e: unknown): boolean => {
    const s = surfaceFor(e);
    if (e instanceof SignInRequired || s.code === "unauthenticated") {
      setSignInRequired(true);
      return true;
    }
    if (e instanceof ApiRequestError && s.code === "subscriptions_closed") {
      setClosedByApi(true);
      setNotice(null);
      setFieldError(null);
      return true;
    }
    return false;
  }, []);

  const submitCreate = useCallback(async () => {
    const address = formAddress.trim();
    if (cooldownUntil !== null && cooldownUntil > Date.now()) return;
    setSubmitting(true);
    setFieldError(null);
    setNotice(null);
    try {
      const row = await createSubscription(address);
      const next = flagFromRow(email, row);
      setFlag(next);
      setNotice(next.state === "pending" ? "Check your email to confirm." : "You are subscribed.");
    } catch (e) {
      if (handleCommon(e)) return;
      const s = surfaceFor(e);
      if (s.code === "address_taken") {
        setFieldError("That address is attached to a different account.");
      } else if (s.code === "already_subscribed") {
        setFieldError("You are already receiving alerts at that address.");
      } else if (s.code === "validation_failed") {
        setFieldError(s.fieldErrors.address ?? "Please enter a valid email address.");
      } else if (s.code === "rate_limited") {
        const secs = s.retryAfterSeconds ?? 30;
        setCooldownUntil(Date.now() + secs * 1000);
        setNowMs(Date.now());
        setFieldError(`Too many requests. Try again in ${secs}s.`);
      } else {
        setFieldError(s.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [cooldownUntil, email, formAddress, handleCommon, setFlag]);

  const resend = useCallback(
    async (current: SubscriptionFlag) => {
      setFieldError(null);
      setNotice(null);
      try {
        const row = await resendVerification(current.id);
        setFlag({ ...current, address: row.address ?? current.address });
        setNotice("Confirmation resent.");
      } catch (e) {
        if (handleCommon(e)) return;
        const s = surfaceFor(e);
        if (e instanceof ApiRequestError && s.code === "already_verified") {
          setFlag({ ...current, state: "active" });
          return;
        }
        setFieldError(s.message);
      }
    },
    [handleCommon, setFlag],
  );

  const unsubscribeFlag = useCallback(
    async (current: SubscriptionFlag) => {
      setFieldError(null);
      setNotice(null);
      try {
        await deleteSubscription(current.id);
        clearFlag();
        setNotice("You are unsubscribed.");
      } catch (e) {
        if (handleCommon(e)) return;
        setFieldError(surfaceFor(e).message);
      }
    },
    [clearFlag, handleCommon],
  );

  if (signInRequired) {
    return <SignedOut data={data} bundle={bundle} onSignIn={onSignIn} />;
  }

  const cooldownSecs =
    cooldownUntil !== null ? Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000)) : 0;

  return (
    <div className={styles.alertsSignup} data-testid="alerts-signed-in">
      {data.heading ? <h2>{data.heading}</h2> : null}
      {data.copy ? <p><Inline text={data.copy} bundle={bundle} /></p> : null}
      <p className={styles.alertsSignupAccount} data-testid="alerts-account">Account: {email}</p>

      {closed ? <p data-testid="alerts-closed">{copy.alerts.closed}</p> : null}

      {flag === null && !closed ? (
        <form
          className={styles.alertsSignupForm}
          onSubmit={(e) => {
            e.preventDefault();
            void submitCreate();
          }}
        >
          <label className={field.field}>
            <span className={field.label}>Email address</span>
            <input
              className={field.input}
              type="email"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError !== null ? "alerts-field-error" : undefined}
            />
          </label>
          <button
            type="submit"
            className={btn.btnFill}
            disabled={submitting || cooldownSecs > 0 || formAddress.trim() === ""}
            data-testid="alerts-submit"
          >
            {cooldownSecs > 0 ? `Wait ${cooldownSecs}s` : "Subscribe"}
          </button>
        </form>
      ) : null}

      {fieldError !== null ? (
        <p id="alerts-field-error" role="alert" data-testid="alerts-field-error">
          {fieldError}
        </p>
      ) : null}
      {notice !== null ? <p data-testid="alerts-notice">{notice}</p> : null}

      {flag !== null ? (
        <ul className={styles.alertsSignupRows} data-testid="alerts-subscriptions">
          <SubscriptionRow
            flag={flag}
            closed={closed}
            onResend={() => void resend(flag)}
            onUnsubscribe={() => void unsubscribeFlag(flag)}
          />
        </ul>
      ) : null}

      <AlertsList alerts={alerts} />
    </div>
  );
}

function SubscriptionRow({
  flag,
  closed,
  onResend,
  onUnsubscribe,
}: {
  flag: SubscriptionFlag;
  closed: boolean;
  onResend: () => void;
  onUnsubscribe: () => void;
}) {
  const pending = flag.state === "pending";
  return (
    <li className={styles.alertsSignupRow} data-testid={`subscription-${flag.id}`}>
      <div className={styles.alertsSignupRowWho}>
        <span className={styles.alertsSignupRowAddress}>{flag.address}</span>
      </div>
      <StatusPill tone={pending ? "warn" : "ok"} testId="subscription-state">
        <span data-testid="subscription-state-label">
          {pending ? copy.alerts.pending : copy.alerts.active}
        </span>
      </StatusPill>
      {pending && !closed ? (
        <button
          type="button"
          className={styles.alertsSignupRowAction}
          onClick={onResend}
          data-testid="subscription-resend"
        >
          Resend confirmation
        </button>
      ) : null}
      <button
        type="button"
        className={styles.alertsSignupRowAction}
        onClick={onUnsubscribe}
        data-testid="subscription-unsubscribe"
      >
        Unsubscribe
      </button>
    </li>
  );
}

function AlertsList({ alerts }: { alerts: SnapshotAlert[] }) {
  const eventName = useStore((s) => s.snapshot?.event?.name ?? "");
  const sorted = useMemo(() => sortAlerts(alerts), [alerts]);
  return (
    <section
      className={styles.alertsSignupSent}
      data-testid="alerts-sent"
      aria-labelledby="alerts-sent-heading"
    >
      <h3 id="alerts-sent-heading" className={styles.alertsSignupSentHeading}>
        {copy.alerts.listHeading}
      </h3>
      {sorted.length === 0 ? (
        <p className={styles.alertsSignupSentEmpty} data-testid="alerts-sent-empty">
          {copy.alerts.empty}
        </p>
      ) : (
        <ul className={styles.alertsSignupSentRows}>
          {sorted.map((row) => (
            <AlertRow key={row.id} row={row} eventName={eventName} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertRow({ row, eventName }: { row: SnapshotAlert; eventName: string }) {
  const kindLabel = alertKindLabel(row.kind);
  return (
    <li className={styles.alertsSignupSentRow} data-testid={`alert-${row.id}`}>
      <div className={styles.alertsSignupSentHead}>
        <span className={styles.alertsSignupSentWhen} data-testid="alert-sent-at">
          {formatEventTime(row.createdAt)}
        </span>
        <span
          className={`${styles.alertsSignupSentKind} ${
            kindLabel === copy.alerts.kindUpdate
              ? styles.alertsSignupSentKindUpdate
              : styles.alertsSignupSentKindStatus
          }`}
          data-testid="alert-kind"
        >
          {kindLabel}
        </span>
      </div>
      <div className={styles.alertsSignupSentEvent} data-testid="alert-event">
        {eventName}
      </div>
      <div className={styles.alertsSignupSentSubject} data-testid="alert-subject">
        {row.subject}
      </div>
      {row.message !== null ? (
        <div className={styles.alertsSignupSentMessage} data-testid="alert-message">
          {row.message}
        </div>
      ) : null}
    </li>
  );
}

export default AlertsSignup;
