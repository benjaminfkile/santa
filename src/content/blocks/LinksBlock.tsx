// docs/site.md section 7.5. Links block: buttons or a list.

import type { Link } from "../../contracts";
import type { BlockComponent } from "../registry";
import { ContentLink } from "../primitives/LinkView";
import * as styles from "../sections/RichText/RichText.module.css";

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
      <ul className={`${styles.blockLinks} ${styles.blockLinksList}`}>
        {links.map((link, i) => (
          <li key={i} className={styles.blockLinksItem}>
            <ContentLink link={link} bundle={bundle} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className={`${styles.blockLinks} ${styles.blockLinksButtons}`}>
      {links.map((link, i) => (
        <ContentLink
          key={i}
          link={link}
          bundle={bundle}
          className={styles.blockLinksButton}
        />
      ))}
    </div>
  );
};
