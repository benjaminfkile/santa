// docs/site.md section 11.2. Completes the sign-in redirect and navigates
// to the `state.returnTo`; on error renders a "Sign-in did not complete"
// page with a Try again link.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserManager } from "./userManager";
import { signIn } from "./signOut";
import * as btn from "../ui/Button.module.css";

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const um = await getUserManager();
        const user = await um.signinRedirectCallback();
        if (!alive) return;
        const returnTo =
          (user.state as { returnTo?: unknown } | undefined)?.returnTo;
        navigate(typeof returnTo === "string" ? returnTo : "/", { replace: true });
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (error === null) {
    return (
      <main id="main">
        <p>Signing you in…</p>
      </main>
    );
  }
  return (
    <main id="main">
      <h1>Sign-in did not complete</h1>
      <p>Something went wrong finishing the sign-in.</p>
      <p>
        <button
          type="button"
          className={btn.btn}
          onClick={() => {
            void signIn("/");
          }}
        >
          Try again
        </button>{" "}
        <a href="/">Home</a>
      </p>
    </main>
  );
}
