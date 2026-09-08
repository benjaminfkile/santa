// docs/site.md section 7.5. Renders the parsed inline tokens as React.

import { Fragment } from "react";
import type { ReactNode } from "react";
import type { ContentBundle } from "../../store/types";
import { parseInline, type InlineNode } from "./parse";
import { resolvePlaceholder } from "./placeholders";
import type { Snapshot } from "../../contracts";
import { Icon } from "../primitives/Icon";
import { LinkView } from "../primitives/LinkView";

type EventFields = NonNullable<Snapshot["event"]>;

export type InlineProps = {
  text: string | null | undefined;
  bundle: ContentBundle;
  event?: EventFields | null;
};

export function Inline({ text, bundle, event }: InlineProps) {
  if (text === null || text === undefined || text === "") return null;
  const nodes = parseInline(text);
  return <>{renderNodes(nodes, bundle, event ?? null)}</>;
}

function renderNodes(
  nodes: InlineNode[],
  bundle: ContentBundle,
  event: EventFields | null,
): ReactNode {
  return nodes.map((node, i) => (
    <Fragment key={i}>{renderNode(node, bundle, event)}</Fragment>
  ));
}

function renderNode(
  node: InlineNode,
  bundle: ContentBundle,
  event: EventFields | null,
): ReactNode {
  if (node.kind === "text") return node.text;
  if (node.kind === "br") return <br />;
  if (node.kind === "strong") return <strong>{renderNodes(node.children, bundle, event)}</strong>;
  if (node.kind === "em") return <em>{renderNodes(node.children, bundle, event)}</em>;
  if (node.kind === "code") return <code>{node.text}</code>;
  if (node.kind === "link") {
    return (
      <LinkView href={node.href} bundle={bundle}>
        {renderNodes(node.label, bundle, event)}
      </LinkView>
    );
  }
  if (node.kind === "icon") {
    return (
      <Icon
        icon={{ source: node.source, id: node.id }}
        bundle={bundle}
        alt=""
        decorative
        inline
      />
    );
  }
  return resolvePlaceholder(event, node.field);
}
