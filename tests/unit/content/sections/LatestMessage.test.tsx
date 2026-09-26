// docs/site.md section 7.2 and 7.4. A `latest_message` section with no
// message returns null; the frame's `.content` div is left empty so the
// frame's CSS rule collapses the section (no card, no space taken). When
// a message is present the same frame renders the card body around it.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { SectionFrame } from "../../../../src/content/SectionFrame";
import { LatestMessage } from "../../../../src/content/sections/LatestMessage/LatestMessage";
import { store } from "../../../../src/store/useStore";
import { initialStore } from "../../../../src/store/types";
import type { ContentBundle } from "../../../../src/store/types";
import type { Presentation, Snapshot } from "../../../../src/contracts";

const bundle: ContentBundle = {
  content: null as unknown as ContentBundle["content"],
  media: {},
  icons: {},
};

const presentation: Presentation = {
  width: "wide",
  align: "start",
  background: { kind: "none" },
  spacing: "normal",
  iconBefore: null,
  iconAfter: null,
  anchor: null,
};

function setSnapshot(event: Snapshot["event"]) {
  act(() => store.setState({ snapshot: { schemaVersion: 1, event } as Snapshot }));
}

beforeEach(() => {
  act(() => store.setState({ ...initialStore }));
});

afterEach(() => {
  cleanup();
  act(() => store.setState({ ...initialStore }));
});

describe("LatestMessage inside a SectionFrame", () => {
  it("with no message: the frame's content div is empty so the CSS rule collapses the section", () => {
    setSnapshot({ statusId: 4, latestMessage: null });
    const { container, getByTestId } = render(
      <SectionFrame presentation={presentation} bundle={bundle} kind="latest_message">
        <LatestMessage data={{}} items={[]} bundle={bundle} />
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    const content = getByTestId("section-frame-content");
    expect(section.contains(content)).toBe(true);
    expect(content.children.length).toBe(0);
    expect(content.textContent).toBe("");
    expect(section.textContent).toBe("");
    expect(container.querySelector('[data-testid="latest-message"]')).toBeNull();
  });

  it("with a message: the card is rendered around the message body", () => {
    setSnapshot({
      statusId: 3,
      latestMessage: {
        id: 1,
        body: "Weather report",
        eventTime: "2026-12-24T12:00:00Z",
        createdAt: "2026-12-24T12:00:00Z",
      },
    } as unknown as Snapshot["event"]);
    const { container, getByTestId } = render(
      <SectionFrame presentation={presentation} bundle={bundle} kind="latest_message">
        <LatestMessage data={{}} items={[]} bundle={bundle} />
      </SectionFrame>,
    );
    const section = container.querySelector("section")!;
    expect(section.dataset.card).toBe("true");
    const message = getByTestId("latest-message");
    expect(message.textContent).toContain("Weather report");
    const content = getByTestId("section-frame-content");
    expect(content.children.length).toBeGreaterThan(0);
  });
});
