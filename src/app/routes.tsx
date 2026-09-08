// docs/site.md section 4. The route table. Live-status takeover: while
// live.eventStatusId === 3 every path outside the four site-coded paths
// renders the live role page. Two legacy redirects: /santa -> /,
// /funding -> /donate.

import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SlugPage } from "../pages/SlugPage";
import { PreviewPage } from "../pages/PreviewPage";
import { NotFound } from "../pages/NotFound";
import { useStore } from "../store/useStore";

const SITE_CODED = new Set(["/auth/callback", "/alerts/verify", "/alerts/unsubscribe", "/preview"]);

export function AppRoutes() {
  const status = useStore((s) => s.live?.eventStatusId ?? null);
  const isLiveTakeover = status === 3;

  if (isLiveTakeover) {
    return (
      <Routes>
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPlaceholder />} />
        <Route path="/alerts/verify" element={<AlertsVerifyPlaceholder />} />
        <Route path="/alerts/unsubscribe" element={<AlertsUnsubscribePlaceholder />} />
        <Route path="*" element={<LiveTakeoverGuard><HomePage /></LiveTakeoverGuard>} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPlaceholder />} />
      <Route path="/alerts/verify" element={<AlertsVerifyPlaceholder />} />
      <Route path="/alerts/unsubscribe" element={<AlertsUnsubscribePlaceholder />} />
      <Route path="/santa" element={<Navigate to="/" replace />} />
      <Route path="/funding" element={<Navigate to="/donate" replace />} />
      <Route path="/:slug" element={<SlugPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function LiveTakeoverGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export { SITE_CODED };

function AuthCallbackPlaceholder() {
  return <main id="main"><p>Signing in…</p></main>;
}
function AlertsVerifyPlaceholder() {
  return <main id="main"><p>Alerts verify (S6).</p></main>;
}
function AlertsUnsubscribePlaceholder() {
  return <main id="main"><p>Alerts unsubscribe (S6).</p></main>;
}
