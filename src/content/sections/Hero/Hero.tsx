// docs/site.md section 7.4. Hero section: title as <h1>, tagline, icon
// above title, up to two links as buttons; height picks a min-height token.

import type { IconRef, Link } from "../../../contracts";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { ContentLink } from "../../primitives/LinkView";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";

type HeroData = {
  title?: string;
  tagline?: string | null;
  icon?: IconRef | null;
  links?: Link[];
  height?: "short" | "tall";
};

function readData(data: unknown): HeroData {
  if (data === null || typeof data !== "object") return {};
  return data as HeroData;
}

export const Hero: SectionComponent = ({ data, bundle }) => {
  const d = readData(data);
  const height = d.height ?? "tall";
  const links = Array.isArray(d.links) ? d.links.slice(0, 2) : [];
  const event = useSnapshotEvent();
  return (
    <div className={`hero hero--${height}`}>
      {d.icon ? (
        <div className="hero__icon" aria-hidden>
          <Icon icon={d.icon} bundle={bundle} decorative size={72} />
        </div>
      ) : null}
      <h1 className="hero__title">
        <Inline text={d.title ?? ""} bundle={bundle} event={event} />
      </h1>
      {d.tagline ? (
        <p className="hero__tagline">
          <Inline text={d.tagline} bundle={bundle} event={event} />
        </p>
      ) : null}
      {links.length > 0 ? (
        <div className="hero__links">
          {links.map((link, i) => (
            <ContentLink
              key={i}
              link={link}
              bundle={bundle}
              className={`hero__link hero__link--${i === 0 ? "primary" : "secondary"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
