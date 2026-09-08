// docs/site.md section 4. The route table. Live-status takeover: while
// live.eventStatusId === 3 every path outside the four site-coded paths
// renders the live role page. Two legacy redirects: /santa -> /,
// /funding -> /donate.
//
// Route-level lazy() for the alerts and auth chunks per section 18.

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SlugPage } from "../pages/SlugPage";
import { PreviewPage } from "../pages/PreviewPage";
import { NotFound } from "../pages/NotFound";
import { Loading } from "../pages/Loading";
import { useStore } from "../store/useStore";

const VerifyPage = lazy(() =>
  import("../pages/Alerts/VerifyPage").then((m) => ({ default: m.VerifyPage })),
);
const UnsubscribePage = lazy(() =>
  import("../pages/Alerts/UnsubscribePage").then((m) => ({ default: m.UnsubscribePage })),
);
const AuthCallback = lazy(() =>
  import("../auth/AuthCallback").then((m) => ({ default: m.AuthCallback })),
);

const SITE_CODED = new Set(["/auth/callback", "/alerts/verify", "/alerts/unsubscribe", "/preview"]);

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

export function AppRoutes() {
  const status = useStore((s) => s.live?.eventStatusId ?? null);
  const isLiveTakeover = status === 3;

  if (isLiveTakeover) {
    return (
      <Routes>
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/auth/callback" element={<Lazy><AuthCallback /></Lazy>} />
        <Route path="/alerts/verify" element={<Lazy><VerifyPage /></Lazy>} />
        <Route path="/alerts/unsubscribe" element={<Lazy><UnsubscribePage /></Lazy>} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/auth/callback" element={<Lazy><AuthCallback /></Lazy>} />
      <Route path="/alerts/verify" element={<Lazy><VerifyPage /></Lazy>} />
      <Route path="/alerts/unsubscribe" element={<Lazy><UnsubscribePage /></Lazy>} />
      <Route path="/santa" element={<Navigate to="/" replace />} />
      <Route path="/funding" element={<Navigate to="/donate" replace />} />
      <Route path="/:slug" element={<SlugPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export { SITE_CODED };
