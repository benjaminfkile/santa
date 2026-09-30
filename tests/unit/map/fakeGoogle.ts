// A small stand-in for the Google Maps libraries: enough of `Map`,
// `OverlayView`, `Polyline`, `Marker`, and the global `google.maps`
// namespace for the real MapView, controller, Santa marker, flight history
// overlay, and user location to run under jsdom. Every object records
// whether it is attached so a test can see what is still on a map.

type Listener = (...args: unknown[]) => void;

export class FakeMap {
  static instances: FakeMap[] = [];
  listeners = new Map<string, Set<Listener>>();
  zoom: number;
  center: google.maps.LatLngLiteral;
  mapTypeId = "terrain";
  panes = {
    markerLayer: document.createElement("div"),
    overlayLayer: document.createElement("div"),
  };
  container: HTMLElement;
  constructor(container: HTMLElement, opts: { zoom?: number; center?: google.maps.LatLngLiteral }) {
    this.container = container;
    this.zoom = opts.zoom ?? 8;
    this.center = opts.center ?? { lat: 0, lng: 0 };
    FakeMap.instances.push(this);
  }
  addListener(name: string, fn: Listener) {
    let set = this.listeners.get(name);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(fn);
    return { remove: () => set.delete(fn) };
  }
  trigger(name: string) {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn();
  }
  listenerCount(): number {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
  setOptions() {}
  getZoom() {
    return this.zoom;
  }
  setZoom(z: number) {
    this.zoom = z;
    this.trigger("zoom_changed");
  }
  panTo(p: google.maps.LatLngLiteral) {
    this.center = p;
  }
  setMapTypeId(t: string) {
    this.mapTypeId = t;
  }
  fitBounds() {}
}

// Like the real API, `setMap` attaches later: `onAdd` and the first `draw`
// run on a microtask, once the map's panes exist.
export class FakeOverlayView {
  static instances: FakeOverlayView[] = [];
  private map: FakeMap | null = null;
  private added = false;
  onAdd?(): void;
  draw?(): void;
  onRemove?(): void;
  constructor() {
    FakeOverlayView.instances.push(this);
  }
  getPanes() {
    return this.added && this.map !== null ? this.map.panes : null;
  }
  getProjection() {
    if (!this.added) return undefined;
    return {
      fromLatLngToDivPixel: (p: google.maps.LatLngLiteral) => ({ x: p.lng * 10, y: p.lat * 10 }),
    };
  }
  getMap() {
    return this.map;
  }
  setMap(map: FakeMap | null) {
    if (map === this.map) return;
    if (this.map !== null && this.added) {
      this.added = false;
      this.onRemove?.();
    }
    this.map = map;
    if (map !== null) {
      queueMicrotask(() => {
        if (this.map !== map || this.added) return;
        this.added = true;
        this.onAdd?.();
        this.draw?.();
      });
    }
  }
}

export class FakeMapObject {
  static live = new Set<FakeMapObject>();
  map: unknown = null;
  opts: { map?: unknown } & Record<string, unknown>;
  constructor(opts: { map?: unknown } & Record<string, unknown>) {
    this.opts = opts;
    this.setMap(opts.map ?? null);
  }
  setMap(m: unknown) {
    this.map = m;
    if (m === null) FakeMapObject.live.delete(this);
    else FakeMapObject.live.add(this);
  }
  getMap() {
    return this.map;
  }
  setOptions() {}
  setPath() {}
  setIcon() {}
  setPosition() {}
  setVisible() {}
}

export function fakeLibs() {
  return {
    maps: {
      Map: FakeMap,
      OverlayView: FakeOverlayView,
      Polyline: FakeMapObject,
    },
    marker: { Marker: FakeMapObject },
    geometry: { spherical: { computeDistanceBetween: () => 1000 } },
  } as unknown as import("../../../src/map/loadMaps").MapsLibs;
}

export function installFakeGoogle(): void {
  class LatLngBounds {
    extend() {
      return this;
    }
  }
  class LatLng {
    lat: number;
    lng: number;
    constructor(lat: number, lng: number) {
      this.lat = lat;
      this.lng = lng;
    }
  }
  class Point {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }
  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      SymbolPath: { CIRCLE: 0, FORWARD_CLOSED_ARROW: 1 },
      LatLngBounds,
      LatLng,
      Point,
    },
  };
}

export function resetFakeGoogle(): void {
  FakeMap.instances = [];
  FakeOverlayView.instances = [];
  FakeMapObject.live.clear();
}

// A promise the test settles by hand, for loader schedules.
export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
