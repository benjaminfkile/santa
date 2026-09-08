// docs/site.md section 19. Covers the app when the site sees an unknown
// schemaVersion; a Reload button calls location.reload().

import { copy } from "../copy/copy";

export type ReloadPromptProps = {
  onReload?: () => void;
};

export function ReloadPrompt({ onReload }: ReloadPromptProps) {
  const handle = () => {
    if (onReload) onReload();
    else if (typeof window !== "undefined") window.location.reload();
  };
  return (
    <main id="main" role="alert">
      <p>{copy.reload.body}</p>
      <button type="button" onClick={handle}>
        {copy.reload.button}
      </button>
    </main>
  );
}
