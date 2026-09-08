// docs/site.md section 4. App root: router, theme application, shell.

import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import "../content/theme/tokens.css";
import { Shell } from "./Shell";
import { AppRoutes } from "./routes";
import { useStore } from "../store/useStore";
import { selectBundle } from "../content/selectPage";
import { applyTheme } from "../content/theme/applyTheme";
import { AuthProvider } from "../auth/AuthProvider";

export function App() {
  const bundle = useStore(selectBundle);

  useEffect(() => {
    if (bundle === null || bundle.content === null) return;
    applyTheme({
      theme: bundle.content.settings.theme,
      favicon: bundle.content.settings.favicon,
      bundle,
    });
  }, [bundle]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell>
          <AppRoutes />
        </Shell>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
