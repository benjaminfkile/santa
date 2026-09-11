// docs/site.md section 7.4. Links section: buttons, cards, or a list.

import type { Link } from "../../../contracts";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { ContentLink, LinkView } from "../../primitives/LinkView";
import { Icon } from "../../primitives/Icon";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";
import "./Links.module.css";

type LinksItem = { link: Link; description: string | null };

type LinksData = {
  heading?: string | null;
  style?: "buttons" | "cards" | "list";
};

function readItems(items: { id: number; data: unknown }[]): LinksItem[] {
  return items
    .map((it) => (it.data ?? {}) as Partial<LinksItem>)
    .filter((d): d is LinksItem => Boolean(d.link))
    .map((d) => ({ link: d.link as Link, description: d.description ?? null }));
}

export const Links: SectionComponent = ({ data, items, bundle }) => {
  const d = (data ?? {}) as LinksData;
  const style = d.style ?? "buttons";
  const parsed = readItems(items);
  const event = useSnapshotEvent();
  return (
    <div className={`links links--${style}`}>
      {d.heading ? (
        <h2 className="links__heading">
          <Inline text={d.heading} bundle={bundle} event={event} />
        </h2>
      ) : null}
      {style === "cards" ? (
        <div className="links__cards">
          {parsed.map((item, i) => (
            <LinkView
              key={i}
              href={item.link.href}
              bundle={bundle}
              newTab={item.link.newTab}
              className="links__card"
            >
              {item.link.icon ? (
                <span className="links__card-icon" aria-hidden>
                  <Icon icon={item.link.icon} bundle={bundle} decorative size={36} />
                </span>
              ) : null}
              <h3 className="links__card-label">
                <Inline text={item.link.label} bundle={bundle} event={event} />
              </h3>
              {item.description ? (
                <p className="links__card-description">
                  <Inline text={item.description} bundle={bundle} event={event} />
                </p>
              ) : null}
            </LinkView>
          ))}
        </div>
      ) : style === "list" ? (
        <ul className="links__list">
          {parsed.map((item, i) => (
            <li key={i} className="links__list-item">
              <ContentLink link={item.link} bundle={bundle} />
              {item.description ? (
                <span className="links__list-description">
                  <Inline text={item.description} bundle={bundle} event={event} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="links__buttons">
          {parsed.map((item, i) => (
            <ContentLink
              key={i}
              link={item.link}
              bundle={bundle}
              className="links__button"
            />
          ))}
        </div>
      )}
    </div>
  );
};
