// docs/site.md sections 4 and 5.4. SlugPage renders the none page for
// /:slug, redirects role slugs to /, and renders NotFound for unknown.

import { Navigate, useParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { selectBundle, selectSlug, surfaceEqual } from "../content/selectPage";
import { PageRenderer } from "../content/PageRenderer";
import { Loading } from "./Loading";
import { ReloadPrompt } from "./ReloadPrompt";
import { NotFound } from "./NotFound";

export function SlugPage() {
  const { slug = "" } = useParams();
  const surface = useStore((s) => selectSlug(s, slug), surfaceEqual);
  const bundle = useStore(selectBundle);
  if (surface.kind === "loading") return <Loading />;
  if (surface.kind === "reload") return <ReloadPrompt />;
  if (surface.kind === "notFound") return <NotFound />;
  if (surface.kind === "redirectHome") return <Navigate to="/" replace />;
  if (bundle === null || bundle.content === null) return <Loading />;
  return <PageRenderer page={surface.page} bundle={bundle} />;
}
