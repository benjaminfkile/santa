// docs/site.md section 11.2. Sign-up: email, password, confirm password.
// Client checks: valid address shape, 12 character minimum, both passwords
// equal. On success navigates to /auth/confirm?email=&returnTo=.

import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { readReturnTo, withReturnTo } from "./returnTo";
import { cognito } from "../../auth/cognito";
import { signUpMessage } from "../../auth/errors";
import { setPendingSignUp } from "./pendingSignUp";
import { copy } from "../../copy/copy";
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
    if (password.length < 12) {
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
      navigate(
        withReturnTo(`/auth/confirm?email=${encodeURIComponent(clean)}`, returnTo),
        { replace: true },
      );
    } catch (err) {
      setError(signUpMessage(err));
      setSubmitting(false);
    }
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
            minLength={12}
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
            minLength={12}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
      </form>
    </AuthCard>
  );
}

export default SignUpPage;
