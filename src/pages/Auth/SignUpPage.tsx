// docs/site.md section 11.2. Sign-up: email, password, confirm password.
// Client checks: valid address shape, 8 character minimum, both passwords
// equal. Under the confirm-password field an alerts box, checked by
// default and hidden while `snapshot.subscriptionsOpen` is false; when
// checked, a successful sign-up stores the alerts intent of
// `pendingSubscribe.ts`. On success navigates to
// /auth/confirm?email=&returnTo=. While
// `snapshot.signUpsOpen` is false the card shows the closed line and a
// Sign in link in place of the form.

import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { readReturnTo, withReturnTo } from "./returnTo";
import { cognito } from "../../auth/cognito";
import { signUpMessage } from "../../auth/errors";
import { setPendingSignUp } from "./pendingSignUp";
import { clearPendingSubscribe, setPendingSubscribe } from "../../alerts/pendingSubscribe";
import { copy } from "../../copy/copy";
import { useStore } from "../../store/useStore";
import * as field from "../../ui/Field.module.css";
import * as btn from "../../ui/Button.module.css";
import * as styles from "./AuthCard.module.css";

// The address-shape check the doc names: local@domain.tld shape, no spaces.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpPage() {
  const [params] = useSearchParams();
  const returnTo = readReturnTo(params);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [alerts, setAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signUpsOpen = useStore((s) => s.snapshot?.signUpsOpen !== false);
  const subscriptionsOpen = useStore((s) => s.snapshot?.subscriptionsOpen !== false);
  const t = copy.auth.signUp;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError(t.invalidEmail);
      return;
    }
    if (password.length < 8) {
      setError(t.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.passwordsDoNotMatch);
      return;
    }
    setSubmitting(true);
    try {
      await cognito.signUp(clean, password);
      setPendingSignUp(clean, password);
      if (alerts && subscriptionsOpen) setPendingSubscribe(clean);
      else clearPendingSubscribe();
      navigate(
        withReturnTo(`/auth/confirm?email=${encodeURIComponent(clean)}`, returnTo),
        { replace: true },
      );
    } catch (err) {
      setError(signUpMessage(err));
      setSubmitting(false);
    }
  }

  if (!signUpsOpen) {
    return (
      <AuthCard
        title={t.title}
        links={[{ to: "/", label: t.links.home }]}
      >
        <p className={styles.notice} data-testid="auth-sign-ups-closed">{copy.auth.closed}</p>
        <Link
          to={withReturnTo("/auth/sign-in", returnTo)}
          className={`${btn.btnFill} ${styles.submit}`}
          data-testid="auth-sign-ups-closed-sign-in"
        >
          {t.links.signIn}
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
      <form className={styles.body} onSubmit={onSubmit} noValidate>
        <label className={field.field}>
          <span className={field.label}>{t.email}</span>
          <input
            className={field.input}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={field.field}>
          <span className={field.label}>{t.password}</span>
          <input
            className={field.input}
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className={field.field}>
          <span className={field.label}>{t.confirmPassword}</span>
          <input
            className={field.input}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {subscriptionsOpen ? (
          <label className={field.check}>
            <input
              className={field.checkInput}
              type="checkbox"
              name="alerts"
              checked={alerts}
              onChange={(e) => setAlerts(e.target.checked)}
              data-testid="auth-sign-up-alerts"
            />
            <span>{t.alerts}</span>
          </label>
        ) : null}
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
      </form>
    </AuthCard>
  );
}

export default SignUpPage;
