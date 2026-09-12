// docs/site.md section 19. Covers the app when the site sees an unknown
// schemaVersion; a Reload button calls location.reload().

import { copy } from "../copy/copy";
import * as btn from "../ui/Button.module.css";

export type ReloadPromptProps = {
  onReload?: () => void;
};

export function ReloadPrompt({ onReload }: ReloadPromptProps) {
  const handle = () => {
    if (onReload) onReload();
    else if (typeof window !== "undefined") window.location.reload();
  };
  return (
    <main id="main">
      <div role="alert">
        <p>{copy.reload.body}</p>
        <button type="button" className={btn.btnFill} onClick={handle}>
          {copy.reload.button}
        </button>
      </div>
    </main>
  );
}
