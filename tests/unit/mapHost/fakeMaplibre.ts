// A small stand-in for `maplibre-gl` for the live tracker's MapLibre
// controller and the fallback tests: a `Map` that records its options,
// every `setStyle`, the camera calls, and its handlers (`fire` runs them),
// and a `Marker` that records where it stands and puts its element in the
// map's container while it is on the map. Use it from a `vi.mock` factory:
// `vi.mock("maplibre-gl", async () => (await import("./fakeMaplibre")).fakeMaplibreModule)`.

import { vi } from "vitest";

type Handler = (event?: unknown) => void;
type StyleShape = {
  sources: Record<string, { type: string; url?: string; data?: unknown }>;
  layers: { id: string; type: string; source?: string; filter?: unknown; layout?: Record<string, unknown>; paint?: Record<string, unknown> }[];
};

export class FakeMlMap {
  static instances: FakeMlMap[] = [];
  options: Record<string, unknown>;
  container: HTMLElement;
  handlers: Record<string, Handler[]> = {};
  onceHandlers: Record<string, Handler[]> = {};
  zoom: number;
  images = new Set<string>();
  removed = false;
  canvas = document.createElement("canvas");
  setStyle = vi.fn();
  fitBounds = vi.fn();
  resize = vi.fn();
  setMinZoom = vi.fn();
  panTo = vi.fn();
  remove = vi.fn(() => {
    this.removed = true;
  });
  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.container = options.container as HTMLElement;
    this.zoom = typeof options.zoom === "number" ? options.zoom : 8;
    FakeMlMap.instances.push(this);
  }
  on(event: string, a: Handler | string, b?: Handler) {
    const fn = typeof a === "function" ? a : b;
    if (fn !== undefined && typeof a === "function") (this.handlers[event] ??= []).push(fn);
    return this;
  }
  once(event: string, fn: Handler) {
    (this.onceHandlers[event] ??= []).push(fn);
    return this;
  }
  fire(event: string, data: unknown = {}) {
    const once = this.onceHandlers[event] ?? [];
    this.onceHandlers[event] = [];
    for (const fn of [...(this.handlers[event] ?? []), ...once]) fn(data);
  }
  getZoom() {
    return this.zoom;
  }
  setZoom(z: number) {
    this.zoom = z;
    this.fire("zoom");
  }
  project([lng, lat]: [number, number]) {
    return { x: lng, y: lat };
  }
  getCanvas() {
    return this.canvas;
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  addImage(id: string) {
    this.images.add(id);
  }
  // The style last applied: the last `setStyle`, else the built one.
  style(): StyleShape {
    const calls = this.setStyle.mock.calls;
    return (calls.length > 0 ? calls[calls.length - 1][0] : this.options.style) as StyleShape;
  }
}

export class FakeMarker {
  static live = new Set<FakeMarker>();
  element: HTMLElement;
  anchor: string | undefined;
  lngLat: [number, number] | null = null;
  map: FakeMlMap | null = null;
  constructor(opts: { element?: HTMLElement; anchor?: string } = {}) {
    this.element = opts.element ?? document.createElement("div");
    this.anchor = opts.anchor;
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }
  addTo(map: FakeMlMap) {
    this.map = map;
    FakeMarker.live.add(this);
    map.container.appendChild(this.element);
    return this;
  }
  remove() {
    this.map = null;
    FakeMarker.live.delete(this);
    this.element.remove();
    return this;
  }
}

export class FakePopup {
  setLngLat() {
    return this;
  }
  setText() {
    return this;
  }
  addTo() {
    return this;
  }
  remove() {}
}

export const fakeMaplibreModule = {
  Map: FakeMlMap,
  Marker: FakeMarker,
  Popup: FakePopup,
  addProtocol: vi.fn(),
  setWorkerUrl: vi.fn(),
};

export function resetFakeMaplibre(): void {
  FakeMlMap.instances.length = 0;
  for (const m of [...FakeMarker.live]) m.remove();
  FakeMarker.live.clear();
}
