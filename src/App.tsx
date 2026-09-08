// Placeholder App for S2 (docs/site.md sections 4 and 5 wire the real app
// in a later task). Shows the live status id from the store so it is
// obvious that the data loop and hub are alive.

import { useStore } from "./store/useStore";
import { copy } from "./copy/copy";

function App() {
  const status = useStore((s) => s.live?.eventStatusId ?? null);
  const hub = useStore((s) => s.hub);
  return (
    <main id="main">
      <h1>WMSFO</h1>
      <p data-testid="live-status-id">{status === null ? copy.loading.initial : `status ${status}`}</p>
      <p data-testid="hub-status">{hub}</p>
    </main>
  );
}

export default App;
