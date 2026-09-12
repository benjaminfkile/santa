// docs/site.md section 13.1. Signed-in: fetches /me and /me/subscriptions
// in parallel once per mount (the loader has no render-time dependencies,
// so a store update never refetches), shows a form (address prefilled with the account email)
// and one row per subscription with resend/unsubscribe/re-subscribe
// actions. Signed-out: signedOutCopy plus a sign-in link.

import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { SectionComponent } from "../../registry";
import type { ContentBundle } from "../../../store/types";
import { useAuth } from "../../../auth/AuthProvider";
import { Inline } from "../../inline/Inline";
import {
  createSubscription,
  deleteSubscription,
  getMe,
  listMySubscriptions,
  resendVerification,
  type Subscription,
} from "../../../api/subscriptions";
import { ApiRequestError, surfaceFor } from "../../../api/errors";
import { SignInRequired } from "../../../auth/getIdToken";
import { StatusPill } from "../../primitives/StatusPill";
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
      formAddress: string;
      submitting: boolean;
      fieldError: string | null;
      cooldownUntil: number | null;
      notice: string | null;
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
      const [me, subs] = await Promise.all([getMe(), listMySubscriptions()]);
      const email = (me.person?.email as string | undefined) ?? "";
      setState({
        kind: "ready",
        email,
        subscriptions: subs.items ?? [],
        formAddress: email,
        submitting: false,
        fieldError: null,
        cooldownUntil: null,
        notice: null,
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

  return (
    <div className={styles.alertsSignup} data-testid="alerts-signed-in">
      {data.heading ? <h2>{data.heading}</h2> : null}
      {data.copy ? <p><Inline text={data.copy} bundle={bundle} /></p> : null}
      <p className={styles.alertsSignupAccount} data-testid="alerts-account">Account: {state.email}</p>
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
  const label = unsubscribed ? "Unsubscribed" : pending ? "Pending" : "Verified";
  return (
    <li className={styles.alertsSignupRow} data-testid={`subscription-${num(row.id)}`}>
      <div className={styles.alertsSignupRowWho}>
        <span className={styles.alertsSignupRowAddress}>{row.address}</span>
        {pending ? (
          <span className={styles.alertsSignupRowMeta}>Check your email</span>
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
