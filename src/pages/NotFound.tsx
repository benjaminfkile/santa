// docs/site.md section 4. NotFound renders for unknown slugs and any path
// the router does not know: the status card with the compass and a link
// back to /.

import { CompassIcon } from "../content/icons/generated/compass";
import { copy } from "../copy/copy";
import { StatusPage } from "./StatusPage";

export function NotFound() {
  return (
    <StatusPage
      icon={CompassIcon}
      title={copy.notFound.heading}
      line={copy.notFound.line}
      action={{ to: "/", label: copy.notFound.home }}
      testId="not-found"
    />
  );
}
