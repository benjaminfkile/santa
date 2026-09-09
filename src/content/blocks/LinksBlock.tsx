// docs/site.md section 7.5. Links block: buttons or a list.

import type { Link } from "../../contracts";
import type { BlockComponent } from "../registry";
import { ContentLink } from "../primitives/LinkView";

type LinksBlockData = {
  links?: Link[];
  style?: "buttons" | "list";
};

export const LinksBlock: BlockComponent = ({ data, bundle }) => {
  const d = (data ?? {}) as LinksBlockData;
  const style = d.style ?? "buttons";
  const links = Array.isArray(d.links) ? d.links : [];
  if (style === "list") {
    return (
      <ul className="block-links block-links--list">
        {links.map((link, i) => (
          <li key={i} className="block-links__item">
            <ContentLink link={link} bundle={bundle} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="block-links block-links--buttons">
      {links.map((link, i) => (
        <ContentLink
          key={i}
          link={link}
          bundle={bundle}
          className="block-links__button"
        />
      ))}
    </div>
  );
};
