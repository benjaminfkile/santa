// docs/site.md section 7.2. Renders a ContentPage as a stack of section
// frames wrapping the kind's component. A `hero` section immediately
// followed by a `countdown` section on the same page renders as one
// two-column row at 760 px and up, with the hero copy left-aligned in the
// first column and the countdown card in the second.

import type { ContentPage, ContentSection } from "../contracts";
import type { ContentBundle } from "../store/types";
import { SectionFrame } from "./SectionFrame";
import { registry, Unknown } from "./registry";
import * as frameStyles from "./SectionFrame.module.css";

export type PageRendererProps = {
  page: ContentPage;
  bundle: ContentBundle;
};

function renderSection(section: ContentSection, bundle: ContentBundle, extraData?: Record<string, unknown>) {
  const Kind = registry.sections[section.kind];
  const data = extraData !== undefined
    ? { ...((section.data ?? {}) as Record<string, unknown>), ...extraData }
    : section.data;
  return Kind ? (
    <Kind
      data={data}
      items={section.items}
      bundle={bundle}
      frame={section.presentation.width}
    />
  ) : (
    <Unknown kind={section.kind} />
  );
}

export function PageRenderer({ page, bundle }: PageRendererProps) {
  const rows: React.ReactNode[] = [];
  const sections = page.sections;
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const next = sections[i + 1];
    if (
      section.kind === "hero" &&
      next !== undefined &&
      next.kind === "countdown"
    ) {
      rows.push(
        <section
          key={section.id}
          className={frameStyles.heroCountdownPair}
          data-testid="hero-countdown-pair"
          data-section-kind="hero+countdown"
        >
          <div className={frameStyles.content}>
            <div className={frameStyles.heroCountdownPairSlot} data-testid="hero-countdown-hero">
              {renderSection(section, bundle, { paired: true })}
            </div>
            <div className={frameStyles.heroCountdownPairSlot} data-testid="hero-countdown-countdown">
              {renderSection(next, bundle)}
            </div>
          </div>
        </section>,
      );
      i += 1;
      continue;
    }
    rows.push(
      <SectionFrame
        key={section.id}
        presentation={section.presentation}
        bundle={bundle}
        kind={section.kind}
      >
        {renderSection(section, bundle)}
      </SectionFrame>,
    );
  }
  return (
    <main id="main" tabIndex={-1} data-page-slug={page.slug} data-page-role={page.role}>
      {rows}
    </main>
  );
}

export function firstSectionKind(page: ContentPage): string | null {
  return page.sections[0]?.kind ?? null;
}
