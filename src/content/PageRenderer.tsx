// docs/site.md section 7.2. Renders a ContentPage as a stack of section
// frames wrapping the kind's component.

import type { ContentPage } from "../contracts";
import type { ContentBundle } from "../store/types";
import { SectionFrame } from "./SectionFrame";
import { registry, Unknown } from "./registry";

export type PageRendererProps = {
  page: ContentPage;
  bundle: ContentBundle;
};

export function PageRenderer({ page, bundle }: PageRendererProps) {
  return (
    <main id="main" tabIndex={-1} data-page-slug={page.slug} data-page-role={page.role}>
      {page.sections.map((section) => {
        const Kind = registry.sections[section.kind];
        return (
          <SectionFrame
            key={section.id}
            presentation={section.presentation}
            bundle={bundle}
            kind={section.kind}
          >
            {Kind ? (
              <Kind data={section.data} items={section.items} bundle={bundle} />
            ) : (
              <Unknown kind={section.kind} />
            )}
          </SectionFrame>
        );
      })}
    </main>
  );
}

export function firstSectionKind(page: ContentPage): string | null {
  return page.sections[0]?.kind ?? null;
}
