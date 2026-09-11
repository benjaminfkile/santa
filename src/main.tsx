// docs/site.md sections 3 and 6.1. Boot order:
//   1. Validate the environment; on failure render the misconfigured page.
//   2. Mount React with the placeholder shell.
//   3. Start the data loop, which imports and starts the hub after the
//      first live object has been applied.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import App from "./App";
import { copy } from "./copy/copy";
import { store } from "./store/useStore";
import { startSystemListener } from "./content/theme/colorScheme";

function renderMisconfigured(root: HTMLElement, variable: string): void {
  root.replaceChildren();
  const container = document.createElement("main");
  const heading = document.createElement("h1");
  heading.textContent = "Site misconfigured";
  const detail = document.createElement("p");
  detail.textContent = copy.errors.misconfigured(variable);
  container.appendChild(heading);
  container.appendChild(detail);
  root.appendChild(container);
}

async function boot(): Promise<void> {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  try {
    await import("./config/env");
  } catch (err) {
    const variable =
      err && typeof err === "object" && "variable" in err
        ? String((err as { variable?: unknown }).variable ?? "")
        : "";
    renderMisconfigured(rootEl, variable || "(unknown)");
    return;
  }

  startSystemListener();

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  const { startDataLoop, pollNow } = await import("./store/loop");
  const { startHub } = await import("./store/hub");
  const { env } = await import("./config/env");

  if (env.ENV !== "production") {
    (window as unknown as { __wmsfo: { getState: () => unknown } }).__wmsfo = {
      getState: () => store.getState(),
    };
  }

  void startDataLoop({
    onFirstApplied: () => startHub({ pollNow }),
  });
}

void boot();
