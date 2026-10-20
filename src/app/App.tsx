// docs/site.md section 4. App root: router, favicon, the tab's preview
// session, scroll on navigation, the subscription flag and alerts
// providers, shell, and the seasonal snow and lights overlays.

import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import "../content/theme/tokens.css";
import { Shell } from "./Shell";
import { AppRoutes } from "./routes";
import { PreviewSession } from "./PreviewSession";
import { ScrollToTop } from "./ScrollToTop";
import { useStore } from "../store/useStore";
import { selectBundle } from "../content/selectPage";
import { AuthProvider } from "../auth/AuthProvider";
import { AlertsProvider } from "../alerts/AlertsProvider";
import { SubscriptionProvider } from "../alerts/SubscriptionProvider";
import { SnowLayer } from "../content/theme/seasonalLayers";
import { OrnamentsLayer } from "../content/theme/OrnamentsLayer";
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
        <PreviewSession />
        <ScrollToTop />
        <OrnamentsLayer bundle={bundle} />
        <SnowLayer bundle={bundle} />
        <SubscriptionProvider>
          <AlertsProvider>
            <Shell>
              <AppRoutes />
            </Shell>
          </AlertsProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
