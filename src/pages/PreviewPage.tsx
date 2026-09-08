// docs/site.md section 7.8. Preview route shell: reads the token and page
// slug from the query string, fetches the bundle from the API, and
// renders the named page under the preview banner. The real fetch flow
// lands in a later slice; this shell keeps the route wiring honest and
// clears the store's preview bundle on unmount.

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { store } from "../store/useStore";
import { useStore } from "../store/useStore";
import { PageRenderer } from "../content/PageRenderer";
import { Loading } from "./Loading";
import { NotFound } from "./NotFound";

export function PreviewPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const pageSlug = params.get("page");
  const preview = useStore((s) => s.preview);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      meta.setAttribute("content", "noindex");
      meta.setAttribute("data-preview-meta", "1");
      document.head.appendChild(meta);
      return () => {
        meta.remove();
        store.setState({ preview: null });
      };
    }
    return () => {
      store.setState({ preview: null });
    };
  }, []);

  if (token === "") return <NotFound />;
  if (preview === null || preview.content === null) return <Loading />;
  const page =
    pageSlug === null
      ? preview.content.pages.find((p) => p.role !== "none") ?? null
      : preview.content.pages.find((p) => p.slug === pageSlug) ?? null;
  if (page === null) return <NotFound />;
  return <PageRenderer page={page} bundle={preview} />;
}
