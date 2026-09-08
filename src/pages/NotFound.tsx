// docs/site.md section 4. NotFound renders for unknown slugs and any path
// the router does not know.

import { Link } from "react-router-dom";
import { copy } from "../copy/copy";

export function NotFound() {
  return (
    <main id="main">
      <h1>{copy.notFound.heading}</h1>
      <p>
        <Link to="/">{copy.notFound.home}</Link>
      </p>
    </main>
  );
}
