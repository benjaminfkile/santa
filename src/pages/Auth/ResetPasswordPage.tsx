// docs/site.md section 11.2. /auth/reset: the emailed code, a new
// password, and a confirmation. On success shows "Password changed" with
// a Sign in button.

import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { readReturnTo } from "./returnTo";
import { cognito } from "../../auth/cognito";
import { resetMessage } from "../../auth/errors";
import { copy } from "../../copy/copy";
import * as field from "../../ui/Field.module.css";
import * as btn from "../../ui/Button.module.css";
import * as styles from "./AuthCard.module.css";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = (params.get("email") ?? "").trim().toLowerCase();
  const returnTo = readReturnTo(params);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [changed, setChanged] = useState(false);
  const t = copy.auth.reset;
  const s = copy.auth.signUp;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || email === "") return;
    setError(null);
    if (password.length < 12) {
      setError(s.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(s.passwordsDoNotMatch);
      return;
    }
    setSubmitting(true);
    try {
      await cognito.reset(email, code.trim(), password);
      setChanged(true);
      setSubmitting(false);
    } catch (err) {
      setError(resetMessage(err));
      setSubmitting(false);
    }
  }

  if (changed) {
    return (
      <AuthCard
        title={t.title}
        links={[{ to: "/", label: t.links.home }]}
      >
        <p className={styles.confirmation}>{t.changed}</p>
        <Link
          to={returnTo === "/" ? "/auth/sign-in" : `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
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
        { to: "/auth/sign-in", label: t.links.signIn },
        { to: "/", label: t.links.home },
      ]}
    >
      <p className={styles.notice}>{copy.auth.forgot.emailed}</p>
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

export default ResetPasswordPage;
