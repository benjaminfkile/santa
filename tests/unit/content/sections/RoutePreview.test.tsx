// docs/site.md sections 7.4, 8.5, 22.1. RoutePreview:
//  - `image` renders the poster picture wrapped in a link to the page
//    holding the `viewer` route_preview when one is published; unlinked
//    otherwise.
//  - `viewer` renders the disclaimer and the OpenSeadragon PosterViewer.
//  - Neither style loads the map chunk.
//
// PosterViewer:
//  - `dzi` present builds a Deep Zoom tile source, absent an image source.
//  - Destroyed on unmount, rebuilt on a new media id.
//  - The fullscreen button calls `requestFullscreen` and falls back to a
//    fixed frame when the API is missing.
//  - The osd chunk is imported only when the section mounts.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { store } from "../../../../src/store/useStore";
import { initialStore, type ContentBundle } from "../../../../src/store/types";
import type { ContentDocument, Snapshot } from "../../../../src/contracts";
import { RoutePreview } from "../../../../src/content/sections/RoutePreview/RoutePreview";
import { PosterViewer } from "../../../../src/content/sections/RoutePreview/PosterViewer";

type OSDCall = {
  element: HTMLElement;
  tileSources: unknown;
  showNavigationControl?: boolean;
  gestureSettingsMouse?: { clickToZoom?: boolean };
  gestureSettingsTouch?: { pinchToZoom?: boolean };
  minZoomImageRatio?: number;
  maxZoomPixelRatio?: number;
  visibilityRatio?: number;
  constrainDuringPan?: boolean;
  animationTime?: number;
};

type FakeViewer = {
  destroy: ReturnType<typeof vi.fn>;
  forceResize: ReturnType<typeof vi.fn>;
  viewport: {
    zoomBy: ReturnType<typeof vi.fn>;
    applyConstraints: ReturnType<typeof vi.fn>;
    goHome: ReturnType<typeof vi.fn>;
    panBy: ReturnType<typeof vi.fn>;
  };
};

const osdImports: OSDCall[] = [];
const viewers: FakeViewer[] = [];

function makeFakeViewer(): FakeViewer {
  return {
    destroy: vi.fn(),
    forceResize: vi.fn(),
    viewport: {
      zoomBy: vi.fn(),
      applyConstraints: vi.fn(),
      goHome: vi.fn(),
      panBy: vi.fn(),
    },
  };
}

vi.mock("openseadragon", () => {
  const fn = (options: OSDCall): FakeViewer => {
    osdImports.push(options);
    const v = makeFakeViewer();
    viewers.push(v);
    return v;
  };
  (fn as unknown as { Point: new (x: number, y: number) => { x: number; y: number } }).Point =
    class {
      x: number;
      y: number;
      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
    } as unknown as new (x: number, y: number) => { x: number; y: number };
  return { default: fn };
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

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
        dzi: "https://cdn.example/poster/poster.dzi",
      },
      "poster-plain": {
        url: "https://cdn.example/plain.jpg",
        kind: "raster",
        width: 1200,
        height: 800,
        alt: "Plain poster",
        variants: {},
        dzi: null,
      },
      "poster-2": {
        url: "https://cdn.example/poster-2.jpg",
        kind: "raster",
        width: 2000,
        height: 1400,
        alt: "Second poster",
        variants: {},
        dzi: "https://cdn.example/poster-2/poster.dzi",
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

beforeEach(() => {
  osdImports.length = 0;
  viewers.length = 0;
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
  Object.defineProperty(document, "webkitFullscreenEnabled", { configurable: true, value: false });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  delete (HTMLElement.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
  delete (HTMLElement.prototype as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
});

afterEach(() => {
  cleanup();
  store.setState(() => ({ ...initialStore }));
});

describe("RoutePreview", () => {
  it("image style renders an unlinked <img> when no viewer page is published", () => {
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
  });

  it("image style wraps the picture in a link to the viewer page when one is published", () => {
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
  });

  it("viewer style renders the disclaimer above the frame and the poster viewer without a map", async () => {
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
    const note = container.querySelector('[role="note"]') as HTMLElement | null;
    const frame = container.querySelector('[data-testid="poster-viewer"]') as HTMLElement | null;
    expect(note).not.toBeNull();
    expect(frame).not.toBeNull();
    expect(note && frame && note.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain("The route is a plan, not a promise.");
    await flushMicrotasks();
  });

  it("image style still uses the 960 variant and a srcset through Media", () => {
    setSnapshotEvent("poster-1");
    const bundle = buildBundle();
    const { container } = render(
      <MemoryRouter>
        <RoutePreview data={{ style: "image" }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    const img = container.querySelector('[data-testid="route-preview-image"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    const srcset = img?.getAttribute("srcset") ?? "";
    expect(srcset).toContain("960");
  });

  it("renders emptyText when the route image id is null", () => {
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
  });
});

describe("PosterViewer", () => {
  it("builds a Deep Zoom tile source when the media entry has a dzi url", async () => {
    render(
      <PosterViewer
        mediaId="poster-1"
        url="https://cdn.example/poster.jpg"
        dzi="https://cdn.example/poster/poster.dzi"
        alt="Route poster"
      />,
    );
    await flushMicrotasks();
    expect(osdImports).toHaveLength(1);
    expect(osdImports[0].tileSources).toBe("https://cdn.example/poster/poster.dzi");
    expect(osdImports[0].showNavigationControl).toBe(false);
    expect(osdImports[0].gestureSettingsMouse?.clickToZoom).toBe(false);
    expect(osdImports[0].gestureSettingsTouch?.pinchToZoom).toBe(true);
    expect(osdImports[0].minZoomImageRatio).toBe(0.8);
    expect(osdImports[0].maxZoomPixelRatio).toBe(2);
    expect(osdImports[0].visibilityRatio).toBe(1);
    expect(osdImports[0].constrainDuringPan).toBe(true);
  });

  it("builds an image tile source when the media entry has no dzi", async () => {
    render(
      <PosterViewer
        mediaId="poster-plain"
        url="https://cdn.example/plain.jpg"
        dzi={null}
        alt="Plain poster"
      />,
    );
    await flushMicrotasks();
    expect(osdImports).toHaveLength(1);
    expect(osdImports[0].tileSources).toEqual({ type: "image", url: "https://cdn.example/plain.jpg" });
  });

  it("destroys the viewer on unmount and rebuilds when the media id changes", async () => {
    const { rerender, unmount } = render(
      <PosterViewer
        mediaId="poster-1"
        url="https://cdn.example/poster.jpg"
        dzi="https://cdn.example/poster/poster.dzi"
        alt="First"
      />,
    );
    await flushMicrotasks();
    expect(viewers).toHaveLength(1);
    const first = viewers[0];
    rerender(
      <PosterViewer
        mediaId="poster-2"
        url="https://cdn.example/poster-2.jpg"
        dzi="https://cdn.example/poster-2/poster.dzi"
        alt="Second"
      />,
    );
    await flushMicrotasks();
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(viewers).toHaveLength(2);
    const second = viewers[1];
    expect(osdImports[1].tileSources).toBe("https://cdn.example/poster-2/poster.dzi");
    unmount();
    await flushMicrotasks();
    expect(second.destroy).toHaveBeenCalledTimes(1);
  });

  it("fullscreen button calls requestFullscreen when the API is present", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const originalRequest = (HTMLElement.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    (HTMLElement.prototype as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen =
      requestFullscreen as unknown as () => Promise<void>;
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    const { getByTestId } = render(
      <PosterViewer
        mediaId="poster-1"
        url="https://cdn.example/poster.jpg"
        dzi="https://cdn.example/poster/poster.dzi"
        alt="Route poster"
      />,
    );
    await flushMicrotasks();
    fireEvent.click(getByTestId("poster-fullscreen"));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    if (originalRequest === undefined) {
      delete (HTMLElement.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    } else {
      (HTMLElement.prototype as unknown as { requestFullscreen: unknown }).requestFullscreen = originalRequest;
    }
  });

  it("falls back to a fixed frame when the Fullscreen API is missing", async () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(document, "webkitFullscreenEnabled", {
      configurable: true,
      value: false,
    });
    delete (HTMLElement.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    delete (HTMLElement.prototype as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
    const { getByTestId } = render(
      <PosterViewer
        mediaId="poster-1"
        url="https://cdn.example/poster.jpg"
        dzi="https://cdn.example/poster/poster.dzi"
        alt="Route poster"
      />,
    );
    await flushMicrotasks();
    const frame = getByTestId("poster-viewer");
    expect(frame.dataset.fullscreen).toBe("off");
    const before = frame.className;
    fireEvent.click(getByTestId("poster-fullscreen"));
    expect(frame.dataset.fullscreen).toBe("on");
    // The fallback adds a class to the frame; the class name is stubbed out
    // in this test environment (css: false), so the assertion is on the
    // class attribute changing rather than on the resolved name.
    expect(frame.className).not.toBe(before);
    fireEvent.click(getByTestId("poster-fullscreen"));
    expect(frame.dataset.fullscreen).toBe("off");
    expect(frame.className).toBe(before);
  });

  it("F on the focused frame toggles fullscreen via the same handler as the button", async () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(document, "webkitFullscreenEnabled", {
      configurable: true,
      value: false,
    });
    delete (HTMLElement.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    delete (HTMLElement.prototype as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
    const { getByTestId } = render(
      <PosterViewer
        mediaId="poster-1"
        url="https://cdn.example/poster.jpg"
        dzi="https://cdn.example/poster/poster.dzi"
        alt="Route poster"
      />,
    );
    await flushMicrotasks();
    const frame = getByTestId("poster-viewer");
    expect(frame.dataset.fullscreen).toBe("off");
    fireEvent.keyDown(frame, { key: "F" });
    expect(frame.dataset.fullscreen).toBe("on");
    fireEvent.keyDown(frame, { key: "f" });
    expect(frame.dataset.fullscreen).toBe("off");
  });

  it("imports the osd chunk only when a viewer-style section mounts, not for the image style", async () => {
    setSnapshotEvent("poster-1");
    const bundle = buildBundle();
    render(
      <MemoryRouter>
        <RoutePreview data={{ style: "image" }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    await flushMicrotasks();
    expect(osdImports).toHaveLength(0);
    cleanup();
    render(
      <MemoryRouter>
        <RoutePreview data={{ style: "viewer" }} items={[]} bundle={bundle} />
      </MemoryRouter>,
    );
    await flushMicrotasks();
    expect(osdImports).toHaveLength(1);
  });
});
