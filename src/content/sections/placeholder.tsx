// docs/site.md section 7.2 (S3). Every real section kind is wired to a
// placeholder that renders its heading and the kind name. Real components
// are added in S4 through S6.

import type { SectionComponent } from "../registry";

function extractHeading(data: unknown): string | null {
  if (data && typeof data === "object" && "heading" in data) {
    const h = (data as { heading?: unknown }).heading;
    if (typeof h === "string" && h !== "") return h;
  }
  if (data && typeof data === "object" && "title" in data) {
    const t = (data as { title?: unknown }).title;
    if (typeof t === "string" && t !== "") return t;
  }
  return null;
}

export function placeholderSection(kind: string): SectionComponent {
  function Section({ data }: { data: unknown }) {
    const heading = extractHeading(data);
    return (
      <div data-placeholder-kind={kind} className={`placeholder placeholder--${kind}`}>
        {heading !== null ? <h2>{heading}</h2> : null}
        <p className="placeholder__kind">{kind}</p>
      </div>
    );
  }
  Section.displayName = `Placeholder(${kind})`;
  return Section;
}
