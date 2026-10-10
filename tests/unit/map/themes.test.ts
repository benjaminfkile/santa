// docs/site.md sections 8.4, 22.1. The themes loader over the snapshot's
// `trackerThemes`: every field maps, in list order; `getStyle` fetches the
// style body once and keeps it, and a rejected fetch is retried on the
// next call; `themesFor` filters by renderer; `resolveInitialTheme` picks
// the stored key when it names an enabled theme of the renderer, then the
// holder of the appearance's default flag, then the first in list order.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  loadThemes,
  resolveInitialTheme,
  themesFor,
  THEME_STORAGE_KEY,
} from "../../../src/map/themes";
import type { Snapshot } from "../../../src/contracts";

type Row = Snapshot["trackerThemes"][number];

let urlSeq = 0;

function row(over: Partial<Row> = {}): Row {
  urlSeq += 1;
  return {
    id: urlSeq,
    renderer: "google",
    key: `theme-${urlSeq}`,
    name: `Theme ${urlSeq}`,
    styleUrl: `https://cdn.example/themes/${urlSeq}.json`,
    spriteUrl: null,
    thumbnailMediaId: null,
    chrome: {
      bg: "#ffffff",
      fg: "#5f6368",
      text: "#202124",
      tile: "#e8f0fe",
      tileFg: "#1a56c4",
      panel: "#ffffffe6",
      accent: "#1a56c4",
    },
    overlay: {
      routeColor: "#1a56c4",
      routeOpacity: 0.9,
      arrowColor: "#ffffff",
      timeLabelBg: "#1c1c1e",
      timeLabelFg: "#ffffff",
      timeLabelOpacity: 0.8,
      userColor: "#c62828",
    },
    defaultLightMode: false,
    defaultDarkMode: false,
    ...over,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  vi.unstubAllGlobals();
});

describe("loadThemes", () => {
  it("maps every snapshot field, in list order", () => {
    const a = row({
      renderer: "maplibre",
      key: "light",
      name: "Light",
      spriteUrl: "https://cdn.example/themes/7/sprites/abc/sprite",
      thumbnailMediaId: "m-1",
      defaultLightMode: true,
    });
    const b = row({ key: "night", name: "Night", defaultDarkMode: true });
    const [first, second] = loadThemes({ trackerThemes: [a, b] });
    expect(first).toMatchObject({
      key: "light",
      renderer: "maplibre",
      name: "Light",
      styleUrl: a.styleUrl,
      spriteUrl: "https://cdn.example/themes/7/sprites/abc/sprite",
      thumbnailMediaId: "m-1",
      defaultLightMode: true,
      defaultDarkMode: false,
      overlay: a.overlay,
      chrome: a.chrome,
    });
    expect(second).toMatchObject({
      key: "night",
      renderer: "google",
      name: "Night",
      spriteUrl: null,
      thumbnailMediaId: null,
      defaultLightMode: false,
      defaultDarkMode: true,
    });
    expect(typeof first.getStyle).toBe("function");
  });

  it("gives an empty list for no snapshot or no themes", () => {
    expect(loadThemes(null)).toEqual([]);
    expect(loadThemes({ trackerThemes: [] })).toEqual([]);
  });
});

describe("getStyle", () => {
  it("fetches the style body once and keeps it", async () => {
    const body = [{ featureType: "poi", stylers: [{ visibility: "off" }] }];
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);
    const r = row();
    const [theme] = loadThemes({ trackerThemes: [r] });
    expect(await theme.getStyle()).toEqual(body);
    expect(await theme.getStyle()).toEqual(body);
    // A fresh load of the same row reuses the body too.
    const [again] = loadThemes({ trackerThemes: [r] });
    expect(await again.getStyle()).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(r.styleUrl);
  });

  it("retries a rejected fetch on the next call", async () => {
    const body = [{ elementType: "geometry", stylers: [{ color: "#242f3e" }] }];
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);
    const [theme] = loadThemes({ trackerThemes: [row()] });
    await expect(theme.getStyle()).rejects.toThrow("offline");
    await expect(theme.getStyle()).rejects.toThrow(/503/);
    expect(await theme.getStyle()).toEqual(body);
    expect(await theme.getStyle()).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("themesFor", () => {
  it("keeps the themes of one renderer in list order", () => {
    const themes = loadThemes({
      trackerThemes: [
        row({ key: "g1" }),
        row({ key: "m1", renderer: "maplibre" }),
        row({ key: "g2" }),
      ],
    });
    expect(themesFor(themes, "google").map((t) => t.key)).toEqual(["g1", "g2"]);
    expect(themesFor(themes, "maplibre").map((t) => t.key)).toEqual(["m1"]);
  });
});

describe("resolveInitialTheme", () => {
  const themes = loadThemes({
    trackerThemes: [
      row({ key: "expedition" }),
      row({ key: "standard", defaultLightMode: true }),
      row({ key: "night", defaultDarkMode: true }),
      row({ key: "light", renderer: "maplibre", defaultLightMode: true }),
      row({ key: "dark", renderer: "maplibre", defaultDarkMode: true }),
    ],
  });

  it("picks the stored key when it names an enabled theme of the renderer", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "expedition");
    expect(resolveInitialTheme(themes, "google", "dark")?.key).toBe("expedition");
    expect(resolveInitialTheme(themes, "google", "light")?.key).toBe("expedition");
  });

  it("picks the appearance's flag holder when nothing is stored", () => {
    expect(resolveInitialTheme(themes, "google", "light")?.key).toBe("standard");
    expect(resolveInitialTheme(themes, "google", "dark")?.key).toBe("night");
    expect(resolveInitialTheme(themes, "maplibre", "light")?.key).toBe("light");
    expect(resolveInitialTheme(themes, "maplibre", "dark")?.key).toBe("dark");
  });

  it("ignores a stored key of the other renderer", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(resolveInitialTheme(themes, "google", "light")?.key).toBe("standard");
  });

  it("ignores a stored key the event no longer enables", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "nebula");
    expect(resolveInitialTheme(themes, "google", "dark")?.key).toBe("night");
  });

  it("picks the first in list order when no theme carries the flag", () => {
    const plain = loadThemes({ trackerThemes: [row({ key: "blizzard" }), row({ key: "charcoal" })] });
    expect(resolveInitialTheme(plain, "google", "dark")?.key).toBe("blizzard");
    expect(resolveInitialTheme(plain, "google", "light")?.key).toBe("blizzard");
  });

  it("is null when the renderer has no theme", () => {
    const googleOnly = themesFor(themes, "google");
    expect(resolveInitialTheme(googleOnly, "maplibre", "light")).toBeNull();
  });
});
