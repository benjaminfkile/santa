// docs/site.md section 19. Covers the app when the site sees an unknown
// schemaVersion: the status card with the sparkles and a Reload button
// calling location.reload().

import { SparklesIcon } from "../content/icons/generated/sparkles";
import { copy } from "../copy/copy";
import { StatusPage } from "./StatusPage";

export type ReloadPromptProps = {
  onReload?: () => void;
};

export function ReloadPrompt({ onReload }: ReloadPromptProps) {
  const handle = () => {
    if (onReload) onReload();
    else if (typeof window !== "undefined") window.location.reload();
  };
  return (
    <StatusPage
      icon={SparklesIcon}
      title={copy.reload.title}
      line={copy.reload.body}
      action={{ onClick: handle, label: copy.reload.button }}
      role="alert"
      testId="reload-prompt"
    />
  );
}
