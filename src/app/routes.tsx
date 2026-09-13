// docs/site.md section 4. The route table. Live-status takeover: while
// live.eventStatusId === 3 every path outside the site-coded paths
// renders the live role page. Two legacy redirects: /santa -> /,
// /funding -> /donate.
//
// Route-level lazy() for the alerts and auth chunks per section 18. All
// five auth pages sit in the same auth chunk (docs 11.2, 21.1).

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SlugPage } from "../pages/SlugPage";
import { PreviewPage } from "../pages/PreviewPage";
import { QrPage } from "../pages/QrPage";
import { NotFound } from "../pages/NotFound";
import { Loading } from "../pages/Loading";
import { useStore } from "../store/useStore";

const VerifyPage = lazy(() =>
  import("../pages/Alerts/VerifyPage").then((m) => ({ default: m.VerifyPage })),
);
const UnsubscribePage = lazy(() =>
  import("../pages/Alerts/UnsubscribePage").then((m) => ({ default: m.UnsubscribePage })),
);
const SignInPage = lazy(() =>
  import("../pages/Auth/SignInPage").then((m) => ({ default: m.SignInPage })),
);
const SignUpPage = lazy(() =>
  import("../pages/Auth/SignUpPage").then((m) => ({ default: m.SignUpPage })),
);
const ConfirmPage = lazy(() =>
  import("../pages/Auth/ConfirmPage").then((m) => ({ default: m.ConfirmPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/Auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("../pages/Auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);

const SITE_CODED = new Set([
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/confirm",
  "/auth/forgot",
  "/auth/reset",
  "/alerts/verify",
  "/alerts/unsubscribe",
  "/preview",
]);

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function AuthRoutes() {
  return (
    <>
      <Route path="/auth/sign-in" element={<Lazy><SignInPage /></Lazy>} />
      <Route path="/auth/sign-up" element={<Lazy><SignUpPage /></Lazy>} />
      <Route path="/auth/confirm" element={<Lazy><ConfirmPage /></Lazy>} />
      <Route path="/auth/forgot" element={<Lazy><ForgotPasswordPage /></Lazy>} />
      <Route path="/auth/reset" element={<Lazy><ResetPasswordPage /></Lazy>} />
    </>
  );
}

export function AppRoutes() {
  const status = useStore((s) => s.live?.eventStatusId ?? null);
  const isLiveTakeover = status === 3;

  if (isLiveTakeover) {
    return (
      <Routes>
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/auth/sign-in" element={<Lazy><SignInPage /></Lazy>} />
        <Route path="/auth/sign-up" element={<Lazy><SignUpPage /></Lazy>} />
        <Route path="/auth/confirm" element={<Lazy><ConfirmPage /></Lazy>} />
        <Route path="/auth/forgot" element={<Lazy><ForgotPasswordPage /></Lazy>} />
        <Route path="/auth/reset" element={<Lazy><ResetPasswordPage /></Lazy>} />
        <Route path="/alerts/verify" element={<Lazy><VerifyPage /></Lazy>} />
        <Route path="/alerts/unsubscribe" element={<Lazy><UnsubscribePage /></Lazy>} />
        <Route path="/q/:tag" element={<QrPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/auth/sign-in" element={<Lazy><SignInPage /></Lazy>} />
      <Route path="/auth/sign-up" element={<Lazy><SignUpPage /></Lazy>} />
      <Route path="/auth/confirm" element={<Lazy><ConfirmPage /></Lazy>} />
      <Route path="/auth/forgot" element={<Lazy><ForgotPasswordPage /></Lazy>} />
      <Route path="/auth/reset" element={<Lazy><ResetPasswordPage /></Lazy>} />
      <Route path="/alerts/verify" element={<Lazy><VerifyPage /></Lazy>} />
      <Route path="/alerts/unsubscribe" element={<Lazy><UnsubscribePage /></Lazy>} />
      <Route path="/santa" element={<Navigate to="/" replace />} />
      <Route path="/funding" element={<Navigate to="/donate" replace />} />
      <Route path="/q/:tag" element={<QrPage />} />
      <Route path="/:slug" element={<SlugPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export { SITE_CODED, AuthRoutes };
