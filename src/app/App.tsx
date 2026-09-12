// docs/site.md section 4. App root: router, favicon, shell, and the
// seasonal snow and lights overlays.

import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import "../content/theme/tokens.css";
import { Shell } from "./Shell";
import { AppRoutes } from "./routes";
import { useStore } from "../store/useStore";
import { selectBundle } from "../content/selectPage";
import { AuthProvider } from "../auth/AuthProvider";
import { SnowLayer } from "../content/theme/seasonalLayers";
import { applyFavicon } from "../content/theme/favicon";

export function App() {
  const bundle = useStore(selectBundle);

  useEffect(() => {
    if (bundle === null || bundle.content === null) return;
    applyFavicon(bundle.content.settings.favicon, bundle);
  }, [bundle]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SnowLayer bundle={bundle} />
        <Shell>
          <AppRoutes />
        </Shell>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
