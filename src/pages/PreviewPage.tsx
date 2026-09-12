// docs/site.md section 7.8. Preview: fetches the bundle from
// GET /preview/document?token=..., stores it as store.preview, shows the
// Preview banner (through the shell reading store.preview), and renders
// the page whose slug matches. A 404 renders "This preview link has
// expired". Sets robots=noindex; clears store.preview on unmount.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { store, useStore } from "../store/useStore";
import { PageRenderer } from "../content/PageRenderer";
import { Loading } from "./Loading";
import { NotFound } from "./NotFound";
import { fetchPreviewBundle } from "../api/preview";
import { ApiRequestError } from "../api/errors";
import { selectHome } from "../content/selectPage";
import * as btn from "../ui/Button.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export function PreviewPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const pageSlug = params.get("page");
  const preview = useStore((s) => s.preview);
  const home = useStore(selectHome);
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex");
    meta.setAttribute("data-preview-meta", "1");
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      store.setState({ preview: null });
    };
  }, []);

  const load = useCallback(async () => {
    if (token === "") {
      setState({ kind: "expired" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const bundle = await fetchPreviewBundle(token);
      store.setState({ preview: bundle });
      setState({ kind: "ready" });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) {
        setState({ kind: "expired" });
        return;
      }
      setState({ kind: "error", message: "Could not reach the server." });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "expired") {
    return (
      <main id="main">
        <h1>Preview</h1>
        <p>This preview link has expired.</p>
      </main>
    );
  }
  if (state.kind === "error") {
    return (
      <main id="main">
        <h1>Preview</h1>
        <p>{state.message}</p>
        <button type="button" className={btn.btn} onClick={() => void load()}>Retry</button>
      </main>
    );
  }
  if (preview === null || preview.content === null) return <Loading />;

  const pages = preview.content.pages;
  const page =
    pageSlug === null || pageSlug === ""
      ? pickHomePreviewPage(pages, home)
      : pages.find((p) => p.slug === pageSlug) ?? null;
  if (page === null) return <NotFound />;
  return <PageRenderer page={page} bundle={preview} />;
}

function pickHomePreviewPage(
  pages: import("../contracts").ContentDocument["pages"],
  home: ReturnType<typeof selectHome>,
) {
  if (home.kind === "page") {
    const match = pages.find((p) => p.role === home.page.role);
    if (match) return match;
  }
  return pages.find((p) => p.role !== "none") ?? null;
}
