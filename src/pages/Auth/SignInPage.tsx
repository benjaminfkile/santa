// docs/site.md section 11.2. The site's own sign-in page: email, password,
// submit; on success stores tokens through session.set and navigates to
// returnTo. UserNotConfirmedException routes to /auth/confirm.

import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { readReturnTo, withReturnTo } from "./returnTo";
import { cognito } from "../../auth/cognito";
import { session } from "../../auth/session";
import { isUserNotConfirmed, signInMessage } from "../../auth/errors";
import { copy } from "../../copy/copy";
import * as field from "../../ui/Field.module.css";
import * as btn from "../../ui/Button.module.css";
import * as styles from "./AuthCard.module.css";

export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = readReturnTo(params);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const t = copy.auth.signIn;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const clean = email.trim().toLowerCase();
    try {
      const tokens = await cognito.signIn(clean, password);
      session.set(tokens);
      navigate(returnTo, { replace: true });
    } catch (err) {
      if (isUserNotConfirmed(err)) {
        navigate(
          withReturnTo(`/auth/confirm?email=${encodeURIComponent(clean)}`, returnTo),
          { replace: true },
        );
        return;
      }
      setError(signInMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={t.title}
      links={[
        { to: withReturnTo("/auth/sign-up", returnTo), label: t.links.signUp },
        { to: "/auth/forgot", label: t.links.forgot },
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

export default SignInPage;
