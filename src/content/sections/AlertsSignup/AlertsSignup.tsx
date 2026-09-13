// docs/site.md section 13.1. Signed-in: fetches /me, /me/subscriptions, and
// /me/alerts in parallel once per mount (a store update never refetches),
// shows an account line, a form (address prefilled with the account email;
// hidden behind an "Add another address" link when any subscription is
// already active), one row per subscription with resend/unsubscribe/
// re-subscribe actions, and the alerts-sent-to-you list. Signed-out:
// signedOutCopy plus a sign-in link.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SectionComponent } from "../../registry";
import type { ContentBundle } from "../../../store/types";
import { useAuth } from "../../../auth/AuthProvider";
import { Inline } from "../../inline/Inline";
import {
  createSubscription,
  deleteSubscription,
  getMe,
  listAlerts,
  listMySubscriptions,
  resendVerification,
  type AlertItem,
  type Subscription,
} from "../../../api/subscriptions";
import { ApiRequestError, surfaceFor } from "../../../api/errors";
import { SignInRequired } from "../../../auth/getIdToken";
import { StatusPill } from "../../primitives/StatusPill";
import { formatMountainTime } from "../../../lib/time";
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

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      email: string;
      subscriptions: Subscription[];
      alerts: AlertItem[];
      formAddress: string;
      submitting: boolean;
      fieldError: string | null;
      cooldownUntil: number | null;
      notice: string | null;
      addAnotherOpen: boolean;
    }
  | { kind: "error"; message: string }
  | { kind: "signedOut" };

export const AlertsSignup: SectionComponent = ({ data, bundle }) => {
  const d = readData(data);
  const { state: auth, signIn } = useAuth();
  const location = useLocation();

  if (auth.status === "unknown") {
    return (
      <div className={`${styles.alertsSignup} ${styles.alertsSignupPending}`} data-testid="alerts-pending" />
    );
  }
  if (auth.status !== "signedIn") {
    return (
      <SignedOut
        data={d}
        bundle={bundle}
        onSignIn={() => void signIn(location.pathname + location.search)}
      />
    );
  }
  return <SignedIn data={d} bundle={bundle} />;
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
    <div className={`${styles.alertsSignup} ${styles.alertsSignupSignedOut}`}>
      {data.heading ? <h2>{data.heading}</h2> : null}
      <p><Inline text={data.signedOutCopy ?? ""} bundle={bundle} /></p>
      <button type="button" className={btn.btn} onClick={onSignIn}>Sign in</button>
    </div>
  );
}

function SignedIn({
  data,
  bundle,
}: {
  data: AlertsSignupData;
  bundle: ContentBundle;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [me, subs, alerts] = await Promise.all([
        getMe(),
        listMySubscriptions(),
        listAlerts(),
      ]);
      const email = (me.person?.email as string | undefined) ?? "";
      setState({
        kind: "ready",
        email,
        subscriptions: subs.items ?? [],
        alerts: alerts.items ?? [],
        formAddress: email,
        submitting: false,
        fieldError: null,
        cooldownUntil: null,
        notice: null,
        addAnotherOpen: false,
      });
    } catch (e) {
      const s = surfaceFor(e);
      if (e instanceof SignInRequired || s.code === "unauthenticated") {
        setState({ kind: "signedOut" });
        return;
      }
      setState({ kind: "error", message: s.message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.kind !== "ready" || state.cooldownUntil === null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state]);

  const setReady = useCallback(
    (updater: (s: Extract<LoadState, { kind: "ready" }>) => Extract<LoadState, { kind: "ready" }>) => {
      setState((prev) => (prev.kind !== "ready" ? prev : updater(prev)));
    },
    [],
  );

  const submitCreate = useCallback(async () => {
    if (state.kind !== "ready") return;
    const address = state.formAddress.trim();
    if (state.cooldownUntil !== null && state.cooldownUntil > Date.now()) return;
    setReady((s) => ({ ...s, submitting: true, fieldError: null, notice: null }));
    try {
      const row = await createSubscription(address);
      setReady((s) => ({
        ...s,
        submitting: false,
        subscriptions: mergeSubscription(s.subscriptions, row),
        addAnotherOpen: false,
        notice:
          row.verifiedAt === null || row.verifiedAt === undefined
            ? "Check your email to confirm."
            : "You are subscribed.",
      }));
    } catch (e) {
      handleCreateError(e);
    }
  }, [setReady, state]);

  function handleCreateError(e: unknown) {
    const s = surfaceFor(e);
    if (e instanceof ApiRequestError) {
      if (s.code === "address_taken") {
        setReady((prev) => ({
          ...prev,
          submitting: false,
          fieldError: "That address is attached to a different account.",
        }));
        return;
      }
      if (s.code === "already_subscribed") {
        setReady((prev) => ({
          ...prev,
          submitting: false,
          fieldError: "You are already receiving alerts at that address.",
        }));
        return;
      }
      if (s.code === "validation_failed") {
        setReady((prev) => ({
          ...prev,
          submitting: false,
          fieldError: s.fieldErrors.address ?? "Please enter a valid email address.",
        }));
        return;
      }
      if (s.code === "rate_limited") {
        const secs = s.retryAfterSeconds ?? 30;
        setReady((prev) => ({
          ...prev,
          submitting: false,
          cooldownUntil: Date.now() + secs * 1000,
          fieldError: `Too many requests. Try again in ${secs}s.`,
        }));
        return;
      }
    }
    if (e instanceof SignInRequired || s.code === "unauthenticated") {
      setState({ kind: "signedOut" });
      return;
    }
    setReady((prev) => ({ ...prev, submitting: false, fieldError: s.message }));
  }

  const resend = useCallback(
    async (id: number) => {
      try {
        const row = await resendVerification(id);
        setReady((s) => ({
          ...s,
          subscriptions: mergeSubscription(s.subscriptions, row),
          notice: "Confirmation resent.",
        }));
      } catch (e) {
        const s = surfaceFor(e);
        if (e instanceof ApiRequestError && s.code === "already_verified") {
          await load();
          return;
        }
        setReady((prev) => ({ ...prev, notice: null, fieldError: s.message }));
      }
    },
    [load, setReady],
  );

  const unsubOne = useCallback(
    async (id: number) => {
      try {
        await deleteSubscription(id);
        setReady((s) => ({
          ...s,
          subscriptions: s.subscriptions.map((row) =>
            num(row.id) === id ? { ...row, unsubscribedAt: new Date().toISOString() } : row,
          ),
        }));
      } catch (e) {
        const s = surfaceFor(e);
        setReady((prev) => ({ ...prev, fieldError: s.message }));
      }
    },
    [setReady],
  );

  const resubscribe = useCallback(
    async (address: string) => {
      try {
        const row = await createSubscription(address);
        setReady((s) => ({ ...s, subscriptions: mergeSubscription(s.subscriptions, row) }));
      } catch (e) {
        handleCreateError(e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setReady],
  );

  if (state.kind === "loading") {
    return <div className={styles.alertsSignup} data-testid="alerts-loading">Loading…</div>;
  }
  if (state.kind === "signedOut") {
    return (
      <SignedOut
        data={data}
        bundle={bundle}
        onSignIn={() => {}}
      />
    );
  }
  if (state.kind === "error") {
    return (
      <div className={styles.alertsSignup} data-testid="alerts-error">
        <p role="alert">{state.message}</p>
        <button type="button" className={btn.btn} onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  const cooldownSecs =
    state.cooldownUntil !== null ? Math.max(0, Math.ceil((state.cooldownUntil - nowMs) / 1000)) : 0;

  const hasActive = state.subscriptions.some(isActive);
  const showForm = !hasActive || state.addAnotherOpen;
  const uniqueAddresses = new Set(
    state.subscriptions.map((s) => (s.address ?? "").toLowerCase()).filter((a) => a !== ""),
  );
  const showAlertAddresses = uniqueAddresses.size > 1;

  return (
    <div className={styles.alertsSignup} data-testid="alerts-signed-in">
      {data.heading ? <h2>{data.heading}</h2> : null}
      {data.copy ? <p><Inline text={data.copy} bundle={bundle} /></p> : null}
      <p className={styles.alertsSignupAccount} data-testid="alerts-account">Account: {state.email}</p>

      {showForm ? (
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
              value={state.formAddress}
              onChange={(e) => setReady((s) => ({ ...s, formAddress: e.target.value }))}
              aria-invalid={state.fieldError !== null}
              aria-describedby={state.fieldError !== null ? "alerts-field-error" : undefined}
            />
          </label>
          {state.fieldError !== null ? (
            <p id="alerts-field-error" role="alert" data-testid="alerts-field-error">
              {state.fieldError}
            </p>
          ) : null}
          {state.notice !== null ? (
            <p data-testid="alerts-notice">{state.notice}</p>
          ) : null}
          <button
            type="submit"
            className={btn.btnFill}
            disabled={state.submitting || cooldownSecs > 0 || state.formAddress.trim() === ""}
            data-testid="alerts-submit"
          >
            {cooldownSecs > 0 ? `Wait ${cooldownSecs}s` : "Subscribe"}
          </button>
        </form>
      ) : (
        <>
          {state.notice !== null ? (
            <p data-testid="alerts-notice">{state.notice}</p>
          ) : null}
          <button
            type="button"
            className={styles.alertsSignupAddAnother}
            onClick={() => setReady((s) => ({ ...s, addAnotherOpen: true, fieldError: null }))}
            data-testid="alerts-add-another"
          >
            Add another address
          </button>
        </>
      )}

      <ul className={styles.alertsSignupRows} data-testid="alerts-subscriptions">
        {state.subscriptions.map((row) => (
          <SubscriptionRow
            key={num(row.id)}
            row={row}
            onResend={() => void resend(num(row.id))}
            onUnsubscribe={() => void unsubOne(num(row.id))}
            onResubscribe={() => void resubscribe(row.address ?? "")}
          />
        ))}
      </ul>

      <AlertsSent
        alerts={state.alerts}
        showAddresses={showAlertAddresses}
      />
    </div>
  );
}

function SubscriptionRow({
  row,
  onResend,
  onUnsubscribe,
  onResubscribe,
}: {
  row: Subscription;
  onResend: () => void;
  onUnsubscribe: () => void;
  onResubscribe: () => void;
}) {
  const pending = (row.verifiedAt === null || row.verifiedAt === undefined) && (row.unsubscribedAt === null || row.unsubscribedAt === undefined);
  const unsubscribed = row.unsubscribedAt !== null && row.unsubscribedAt !== undefined;
  const tone = unsubscribed ? "dim" : pending ? "warn" : "ok";
  const label = unsubscribed ? "Unsubscribed" : pending ? "Pending, check your email" : "Active";
  const createdAt = formatMountainTime(row.createdAt);
  return (
    <li className={styles.alertsSignupRow} data-testid={`subscription-${num(row.id)}`}>
      <div className={styles.alertsSignupRowWho}>
        <span className={styles.alertsSignupRowAddress}>{row.address}</span>
        {createdAt ? (
          <span className={styles.alertsSignupRowMeta} data-testid="subscription-created">
            {createdAt}
          </span>
        ) : null}
      </div>
      <StatusPill tone={tone} testId="subscription-state">
        <span data-testid="subscription-state-label">{label}</span>
      </StatusPill>
      {pending ? (
        <button
          type="button"
          className={styles.alertsSignupRowAction}
          onClick={onResend}
        >
          Resend confirmation
        </button>
      ) : !unsubscribed ? (
        <button
          type="button"
          className={styles.alertsSignupRowAction}
          onClick={onUnsubscribe}
        >
          Unsubscribe
        </button>
      ) : (
        <button
          type="button"
          className={styles.alertsSignupRowAction}
          onClick={onResubscribe}
        >
          Re-subscribe
        </button>
      )}
    </li>
  );
}

function AlertsSent({
  alerts,
  showAddresses,
}: {
  alerts: AlertItem[];
  showAddresses: boolean;
}) {
  const sorted = useMemo(() => {
    const list = alerts.slice();
    list.sort((a, b) => {
      const aa = a.sentAt ?? "";
      const bb = b.sentAt ?? "";
      if (aa === bb) return 0;
      return aa < bb ? 1 : -1;
    });
    return list;
  }, [alerts]);
  return (
    <section
      className={styles.alertsSignupSent}
      data-testid="alerts-sent"
      aria-labelledby="alerts-sent-heading"
    >
      <h3 id="alerts-sent-heading" className={styles.alertsSignupSentHeading}>
        Alerts sent to you
      </h3>
      {sorted.length === 0 ? (
        <p className={styles.alertsSignupSentEmpty} data-testid="alerts-sent-empty">
          No alerts have been sent to you yet.
        </p>
      ) : (
        <ul className={styles.alertsSignupSentRows}>
          {sorted.map((row) => (
            <AlertRow key={num(row.id)} row={row} showAddress={showAddresses} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertRow({
  row,
  showAddress,
}: {
  row: AlertItem;
  showAddress: boolean;
}) {
  const sentAt = formatMountainTime(row.sentAt);
  const kindLabel = row.kind === "update" ? "update" : "status";
  return (
    <li className={styles.alertsSignupSentRow} data-testid={`alert-${num(row.id)}`}>
      <div className={styles.alertsSignupSentHead}>
        <span className={styles.alertsSignupSentWhen} data-testid="alert-sent-at">
          {sentAt}
        </span>
        <span
          className={`${styles.alertsSignupSentKind} ${
            kindLabel === "update"
              ? styles.alertsSignupSentKindUpdate
              : styles.alertsSignupSentKindStatus
          }`}
          data-testid="alert-kind"
        >
          {kindLabel}
        </span>
      </div>
      <div className={styles.alertsSignupSentEvent} data-testid="alert-event">
        {row.eventName ?? ""}
      </div>
      <div className={styles.alertsSignupSentSubject} data-testid="alert-subject">
        {row.subject ?? ""}
      </div>
      {showAddress && row.address ? (
        <div className={styles.alertsSignupSentAddress} data-testid="alert-address">
          {row.address}
        </div>
      ) : null}
    </li>
  );
}

function isActive(row: Subscription): boolean {
  const verified = row.verifiedAt !== null && row.verifiedAt !== undefined;
  const unsubscribed = row.unsubscribedAt !== null && row.unsubscribedAt !== undefined;
  return verified && !unsubscribed;
}

function mergeSubscription(list: Subscription[], row: Subscription): Subscription[] {
  const id = num(row.id);
  const found = list.some((r) => num(r.id) === id);
  if (found) return list.map((r) => (num(r.id) === id ? row : r));
  return [...list, row];
}

function num(v: number | string | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default AlertsSignup;
