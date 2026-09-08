// docs/site.md sections 4 and 5.4. HomePage: the role page for
// live.eventStatusId, or loading, or the reload prompt when the store
// says something has changed schema.

import { useStore } from "../store/useStore";
import { selectBundle, selectHome } from "../content/selectPage";
import { PageRenderer } from "../content/PageRenderer";
import { Loading } from "./Loading";
import { ReloadPrompt } from "./ReloadPrompt";

export function HomePage() {
  const surface = useStore(selectHome);
  const bundle = useStore(selectBundle);
  if (surface.kind === "reload") return <ReloadPrompt />;
  if (surface.kind !== "page") return <Loading />;
  if (bundle === null || bundle.content === null) return <Loading />;
  return <PageRenderer page={surface.page} bundle={bundle} />;
}
