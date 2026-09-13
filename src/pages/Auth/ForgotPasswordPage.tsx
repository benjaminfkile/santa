// docs/site.md section 11.2. /auth/forgot: email; on success (and on any
// error other than rate limits) navigates to /auth/reset with the same
// "We emailed you a code" line so no account enumeration leaks.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { cognito } from "../../auth/cognito";
import { forgotMessage } from "../../auth/errors";
import { copy } from "../../copy/copy";
import * as field from "../../ui/Field.module.css";
import * as btn from "../../ui/Button.module.css";
import * as styles from "./AuthCard.module.css";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const t = copy.auth.forgot;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const clean = email.trim().toLowerCase();
    try {
      await cognito.forgot(clean);
      navigate(`/auth/reset?email=${encodeURIComponent(clean)}`, { replace: true });
    } catch (err) {
      const rateLimit = forgotMessage(err);
      if (rateLimit !== null) {
        setError(rateLimit);
        setSubmitting(false);
        return;
      }
      // Same copy whether or not the account exists (no enumeration).
      navigate(`/auth/reset?email=${encodeURIComponent(clean)}`, { replace: true });
    }
  }

  return (
    <AuthCard
      title={t.title}
      links={[
        { to: "/auth/sign-in", label: t.links.signIn },
        { to: "/auth/sign-up", label: t.links.signUp },
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

export default ForgotPasswordPage;
