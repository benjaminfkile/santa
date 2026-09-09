// docs/site.md section 7.4. Icon row section: decorative row of icons with
// optional labels; icons `aria-hidden` when unlabelled.

import type { IconRef } from "../../../contracts";
import type { SectionComponent } from "../../registry";
import { Inline } from "../../inline/Inline";
import { Icon } from "../../primitives/Icon";
import { useSnapshotEvent } from "../../blocks/useSnapshotEvent";

type IconRowItem = { icon: IconRef; label: string | null };

type IconRowData = {
  size?: "sm" | "md" | "lg";
  spacing?: "tight" | "normal" | "loose";
};

const ICON_SIZES: Record<"sm" | "md" | "lg", number> = { sm: 24, md: 48, lg: 96 };

function readItems(items: { id: number; data: unknown }[]): IconRowItem[] {
  return items
    .map((it) => (it.data ?? {}) as Partial<IconRowItem>)
    .filter((d): d is IconRowItem => Boolean(d.icon))
    .map((d) => ({ icon: d.icon as IconRef, label: d.label ?? null }));
}

export const IconRow: SectionComponent = ({ data, items, bundle }) => {
  const d = (data ?? {}) as IconRowData;
  const size = d.size ?? "md";
  const spacing = d.spacing ?? "normal";
  const parsed = readItems(items);
  const event = useSnapshotEvent();
  return (
    <div className={`icon-row icon-row--${size} icon-row--spacing-${spacing}`}>
      {parsed.map((item, i) => (
        <div key={i} className="icon-row__item">
          <Icon
            icon={item.icon}
            bundle={bundle}
            alt=""
            decorative
            size={ICON_SIZES[size]}
          />
          {item.label ? (
            <span className="icon-row__label">
              <Inline text={item.label} bundle={bundle} event={event} />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
};
