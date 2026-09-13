// docs/site.md section 11.2. /auth/confirm: the six-digit code and a
// Resend link (disabled 30 s after each send). When the visitor arrived
// straight from sign-up the page still holds the password in memory and
// signs in directly, landing on returnTo. Otherwise the page shows
// "Account confirmed" and a Sign in button that keeps returnTo.

import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { readReturnTo, withReturnTo } from "./returnTo";
import { cognito } from "../../auth/cognito";
import { session } from "../../auth/session";
import { confirmMessage } from "../../auth/errors";
import { takePendingSignUp } from "./pendingSignUp";
import { copy } from "../../copy/copy";
import * as field from "../../ui/Field.module.css";
import * as btn from "../../ui/Button.module.css";
import * as styles from "./AuthCard.module.css";

const RESEND_LOCKOUT_MS = 30_000;

export function ConfirmPage() {
  const [params] = useSearchParams();
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const returnTo = readReturnTo(params);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const t = copy.auth.confirm;

  useEffect(() => {
    if (resendAt <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now]);

  const resendSecs = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || email === "") return;
    setError(null);
    setSubmitting(true);
    try {
      await cognito.confirm(email, code.trim());
      const pw = takePendingSignUp(email);
      if (pw !== null) {
        try {
          const tokens = await cognito.signIn(email, pw);
          session.set(tokens);
          navigate(returnTo, { replace: true });
          return;
        } catch {
          // Fall through to the confirmed-account state.
        }
      }
      setConfirmed(true);
      setSubmitting(false);
    } catch (err) {
      setError(confirmMessage(err));
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (email === "" || resendSecs > 0) return;
    setError(null);
    setResendAt(Date.now() + RESEND_LOCKOUT_MS);
    setNow(Date.now());
    try {
      await cognito.resendCode(email);
    } catch (err) {
      setError(confirmMessage(err));
    }
  }

  if (confirmed) {
    return (
      <AuthCard
        title={t.title}
        links={[{ to: "/", label: t.links.home }]}
      >
        <p className={styles.confirmation}>{t.confirmed}</p>
        <Link
          to={withReturnTo("/auth/sign-in", returnTo)}
          className={`${btn.btnFill} ${styles.submit}`}
          data-testid="auth-submit"
        >
          {t.signInAfter}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t.title}
      links={[
        { to: withReturnTo("/auth/sign-in", returnTo), label: t.links.signIn },
        { to: "/", label: t.links.home },
      ]}
    >
      <p className={styles.notice}>{t.hint}</p>
      <form className={styles.body} onSubmit={onSubmit} noValidate>
        <label className={field.field}>
          <span className={field.label}>{t.code}</span>
          <input
            className={field.input}
            type="text"
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        {error !== null ? (
          <p className={styles.error} aria-describedby="auth-title" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className={`${btn.btnFill} ${styles.submit}`}
          disabled={submitting}
          data-testid="auth-submit"
        >
          {t.submit}
        </button>
        <button
          type="button"
          className={styles.resend}
          onClick={onResend}
          disabled={resendSecs > 0}
          data-testid="auth-resend"
        >
          {resendSecs > 0 ? t.resendWait(resendSecs) : t.resend}
        </button>
      </form>
    </AuthCard>
  );
}

export default ConfirmPage;
