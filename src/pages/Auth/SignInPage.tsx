// docs/site.md section 11.2. The site's own sign-in page: email, password,
// submit; on success stores tokens through session.set, completes the
// sign-up alerts intent (`completePendingSubscribe`), and navigates to
// returnTo. UserNotConfirmedException routes to /auth/confirm. A session
// the API ended with `403 blocked` shows the blocked notice once (site.md 19).

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { readReturnTo, withReturnTo } from "./returnTo";
import { cognito } from "../../auth/cognito";
import { session } from "../../auth/session";
import { isUserNotConfirmed, signInMessage } from "../../auth/errors";
import { completePendingSubscribe } from "../../alerts/pendingSubscribe";
import { copy } from "../../copy/copy";
import { useStore } from "../../store/useStore";
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
  const [notice, setNotice] = useState(() => session.notice());
  const signUpsOpen = useStore((s) => s.snapshot?.signUpsOpen !== false);
  const t = copy.auth.signIn;

  // Shown once: read at mount, dropped here (an effect, so a strict-mode
  // double render still reads it).
  useEffect(() => {
    session.takeNotice();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const clean = email.trim().toLowerCase();
    try {
      const tokens = await cognito.signIn(clean, password);
      session.set(tokens);
      setNotice(null);
      await completePendingSubscribe(tokens.email);
      // The API refused the account on its first request (`403 blocked`).
      if (session.current() === null && session.notice() === "blocked") {
        setNotice(session.takeNotice());
        setSubmitting(false);
        return;
      }
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
        ...(signUpsOpen ? [{ to: withReturnTo("/auth/sign-up", returnTo), label: t.links.signUp }] : []),
        { to: "/auth/forgot", label: t.links.forgot },
        { to: "/", label: t.links.home },
      ]}
    >
      <form className={styles.body} onSubmit={onSubmit} noValidate>
        {notice === "blocked" ? (
          <p className={styles.notice} role="status" data-testid="auth-blocked">
            {copy.auth.blocked}
          </p>
        ) : null}
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
