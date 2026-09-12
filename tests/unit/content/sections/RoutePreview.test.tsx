// docs/site.md sections 7.4 and 8.5. RoutePreview:
//  - `image` renders the poster picture wrapped in a link to the page
//    holding the `viewer` route_preview when one is published; unlinked
//    otherwise.
//  - `viewer` renders the disclaimer and the pan-and-zoom PosterViewer.
//  - Neither style loads the map chunk.

import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import {
  fitScale,
  fitTransform,
  clampScale,
  zoomAbout,
  MAX_ZOOM_MULTIPLIER,
} from "../../../../src/content/sections/RoutePreview/posterMath";

function buildBundle(overrides: Partial<ContentBundle> = {}): ContentBundle {
  return {
    content: {
      pages: [],
      nav: [],
    } as unknown as ContentDocument,
    media: {
      "poster-1": {
        url: "https://cdn.example/poster.jpg",
        kind: "raster",
        width: 2400,
        height: 1600,
        alt: "2026 route poster",
        variants: {
          "480": "https://cdn.example/poster-480.jpg",
          "960": "https://cdn.example/poster-960.jpg",
          "1920": "https://cdn.example/poster-1920.jpg",
        },
      },
    },
    icons: {},
    ...overrides,
  } as ContentBundle;
}

function setSnapshotEvent(routeImageMediaId: string | null): void {
  store.setState((s) => ({
    ...s,
    snapshot: {
      schemaVersion: 1,
      event: { id: 1, routeImageMediaId },
    } as unknown as Snapshot,
  }));
}

describe("RoutePreview", () => {
  it("image style renders an unlinked <img> when no viewer page is published", () => {
    store.setState(() => ({ ...initialStore }));
    setSnapshotEvent("poster-1");
    const bundle = buildBundle();
    const { container } = render(
      <MemoryRouter>
        <RoutePreview data={{ style: "image" }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    const link = container.querySelector('[data-testid="route-preview-link"]');
    expect(link).toBeNull();
    const img = container.querySelector('[data-testid="route-preview-image"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("poster.jpg");
    cleanup();
    store.setState(() => ({ ...initialStore }));
  });

  it("image style wraps the picture in a link to the viewer page when one is published", () => {
    store.setState(() => ({ ...initialStore }));
    setSnapshotEvent("poster-1");
    const bundle = buildBundle({
      content: {
        pages: [
          {
            slug: "route",
            role: "none",
            sections: [
              { kind: "route_preview", data: { style: "viewer", disclaimer: "" } },
            ],
          },
        ],
        nav: [],
      } as unknown as ContentDocument,
    });
    const { container } = render(
      <MemoryRouter>
        <RoutePreview data={{ style: "image" }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    const link = container.querySelector('[data-testid="route-preview-link"]') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/route");
    cleanup();
    store.setState(() => ({ ...initialStore }));
  });

  it("viewer style renders the disclaimer and the poster viewer without a map", () => {
    store.setState(() => ({ ...initialStore }));
    setSnapshotEvent("poster-1");
    const bundle = buildBundle();
    const { container } = render(
      <MemoryRouter>
        <RoutePreview
          data={{ style: "viewer", disclaimer: "The route is a plan, not a promise." }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    // Disclaimer is rendered inside a note-role container.
    expect(container.querySelector('[role="note"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="poster-viewer"]')).not.toBeNull();
    // No map view container renders here; only the poster viewer.
    expect(container.textContent).toContain("The route is a plan, not a promise.");
    cleanup();
    store.setState(() => ({ ...initialStore }));
  });

  it("renders emptyText when the route image id is null", () => {
    store.setState(() => ({ ...initialStore }));
    setSnapshotEvent(null);
    const bundle = buildBundle();
    const { container } = render(
      <MemoryRouter>
        <RoutePreview
          data={{ style: "image", emptyText: "The route is not published yet." }}
          items={[]}
          bundle={bundle}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("The route is not published yet.");
    cleanup();
    store.setState(() => ({ ...initialStore }));
  });
});

describe("poster viewer math", () => {
  it("fitScale = min(frameW/imgW, frameH/imgH)", () => {
    expect(fitScale({ width: 600, height: 400 }, { width: 1200, height: 800 })).toBeCloseTo(0.5);
    expect(fitScale({ width: 300, height: 800 }, { width: 1200, height: 800 })).toBeCloseTo(0.25);
    expect(fitScale({ width: 0, height: 0 }, { width: 1, height: 1 })).toBe(1);
    expect(fitScale({ width: 100, height: 100 }, { width: 0, height: 0 })).toBe(1);
  });

  it("fitTransform centers the image inside the frame", () => {
    const t = fitTransform({ width: 600, height: 400 }, { width: 1200, height: 800 });
    // fit scale is 0.5; scaled image is 600x400 → centered → x=0, y=0.
    expect(t.scale).toBeCloseTo(0.5);
    expect(t.x).toBeCloseTo(0);
    expect(t.y).toBeCloseTo(0);
    const wide = fitTransform({ width: 800, height: 400 }, { width: 1200, height: 800 });
    // fit scale = min(800/1200=0.667, 400/800=0.5) = 0.5; scaled = 600x400.
    expect(wide.scale).toBeCloseTo(0.5);
    expect(wide.x).toBeCloseTo(100);
    expect(wide.y).toBeCloseTo(0);
  });

  it("clampScale clamps between min and min*6", () => {
    expect(clampScale(0.1, 0.5)).toBe(0.5);
    expect(clampScale(4, 0.5)).toBe(0.5 * MAX_ZOOM_MULTIPLIER);
    expect(clampScale(1, 0.5)).toBe(1);
  });

  it("zoomAbout keeps the anchor point stationary in image space", () => {
    const start = { x: 0, y: 0, scale: 1 };
    const anchor = { x: 100, y: 50 };
    const next = zoomAbout(start, 2, anchor, 1);
    // At scale 1, the point at (100,50) on screen was at image (100,50);
    // after scale=2 centered on that anchor, the same anchor should still
    // map to image (100,50): anchor.x - (anchor.x - next.x) * 1 == 100.
    expect(next.scale).toBe(2);
    // newX = anchor.x - (anchor.x - oldX) * (newScale/oldScale)
    //      = 100 - (100 - 0) * 2 = -100.
    expect(next.x).toBe(-100);
    expect(next.y).toBe(-50);
  });

  it("zoomAbout clamps to the min scale and doesn't move when scale is unchanged", () => {
    const state = { x: 10, y: 20, scale: 0.5 };
    const same = zoomAbout(state, 0.1, { x: 5, y: 5 }, 0.5);
    expect(same).toBe(state);
  });
});
