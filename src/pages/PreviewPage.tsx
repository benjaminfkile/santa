// docs/site.md section 7.8. Preview link: /preview?token=&page=&theme=
// starts the tab's preview session (the PreviewSession component then
// follows the draft into store.preview), waits for the first draft, and
// navigates with replace to / when no page is named and to /<slug>
// otherwise (a role page included). From there every route renders from
// the draft. An expired link lands on / with the expired banner. With no
// draft yet after five failures it shows the error with a Retry button.
// The page itself always carries robots=noindex.

import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { Loading } from "./Loading";
import { usePreviewLive } from "./previewLive";
import {
  getPreviewSession,
  holdNoindex,
  retryPreview,
  startPreviewSession,
  usePreviewSession,
} from "./previewSession";
import { copy } from "../copy/copy";
import * as btn from "../ui/Button.module.css";

export function PreviewPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const pageSlug = params.get("page");
  const themeParam = params.get("theme");
  const theme = themeParam === "light" || themeParam === "dark" ? themeParam : null;
  const session = usePreviewSession();
  const preview = useStore((s) => s.preview);
  const { reconnecting } = usePreviewLive();
  // The session found at mount. If it is an expired one for this token it
  // is from an earlier link and restarts, so it never redirects.
  const [atMount] = useState(getPreviewSession);

  useEffect(() => holdNoindex(), []);

  useEffect(() => {
    if (token === "") return;
    startPreviewSession(token, theme);
  }, [token, theme]);

  if (token === "") {
    return (
      <main id="main">
        <h1>{copy.banners.preview}</h1>
        <p>{copy.banners.previewExpired}</p>
      </main>
    );
  }
  if (session === null || session.token !== token) return <Loading />;
  if (session.expired) {
    if (session === atMount) return <Loading />;
    return <Navigate to="/" replace />;
  }
  if (preview === null || preview.content === null) {
    if (reconnecting) {
      return (
        <main id="main">
          <h1>{copy.banners.preview}</h1>
          <p>{copy.errors.unreachable}</p>
          <button type="button" className={btn.btn} onClick={retryPreview}>
            {copy.banners.previewRetry}
          </button>
        </main>
      );
    }
    return <Loading />;
  }
  return <Navigate to={previewPath(pageSlug)} replace />;
}

// The path the session opens at: / when no page is named, /<slug>
// otherwise. A role page renders at its own slug inside a preview session,
// so the named role page shows whatever the event status (an unknown slug
// renders NotFound).
function previewPath(slug: string | null): string {
  if (slug === null || slug === "") return "/";
  return `/${slug}`;
}
