// docs/site.md section 22.1. QrPage covers section 4: the beacon is sent
// once with the tag and referrer; page, home, and forward resolutions;
// an absent tag goes home; a malformed tag renders NotFound and sends
// nothing; the first snapshot is awaited before both the beacon and the
// navigation.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QrPage } from "../../../src/pages/QrPage";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";
import type { Snapshot } from "../../../src/contracts";

vi.mock("../../../src/api/qr", () => ({
  sendScanBeacon: vi.fn(),
}));

import * as qrApi from "../../../src/api/qr";

function LocationSpy() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/q/:tag" element={<QrPage />} />
        <Route path="*" element={<LocationSpy />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setSnapshot(qrCodes: NonNullable<Snapshot["qrCodes"]>) {
  act(() => {
    store.setState((s) => ({
      ...s,
      snapshot: {
        schemaVersion: 1,
        content: null,
        media: {},
        icons: {},
        event: null,
        qrCodes,
      } as unknown as Snapshot,
      snapshotUrl: "https://cdn/snap.json",
    }));
  });
}

beforeEach(() => {
  vi.mocked(qrApi.sendScanBeacon).mockReset();
  act(() => {
    store.setState({ ...initialStore });
  });
  Object.defineProperty(document, "referrer", {
    configurable: true,
    get: () => "https://ref.example/",
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("QrPage", () => {
  it("waits for the first snapshot before beaconing or navigating", async () => {
    const { getByTestId } = renderAt("/q/qr-001");
    // No snapshot yet: nothing happens.
    expect(qrApi.sendScanBeacon).not.toHaveBeenCalled();
    expect(() => getByTestId("location")).toThrow();

    setSnapshot({ "qr-001": { pageSlug: "sponsors", forwardUrl: null } });
    await waitFor(() => expect(qrApi.sendScanBeacon).toHaveBeenCalledTimes(1));
    expect(qrApi.sendScanBeacon).toHaveBeenCalledWith("qr-001", "https://ref.example/");
    await waitFor(() => expect(getByTestId("location").textContent).toBe("/sponsors"));
  });

  it("resolves to /<pageSlug> when the entry has a pageSlug", async () => {
    setSnapshot({ "qr-001": { pageSlug: "sponsors", forwardUrl: null } });
    const { getByTestId } = renderAt("/q/qr-001");
    await waitFor(() => expect(getByTestId("location").textContent).toBe("/sponsors"));
    expect(qrApi.sendScanBeacon).toHaveBeenCalledTimes(1);
  });

  it("resolves to / when the entry's pageSlug is the home page", async () => {
    setSnapshot({ "qr-002": { pageSlug: "/", forwardUrl: null } });
    const { getByTestId } = renderAt("/q/qr-002");
    await waitFor(() => expect(getByTestId("location").textContent).toBe("/"));
    expect(qrApi.sendScanBeacon).toHaveBeenCalledTimes(1);
  });

  it("forwards through window.location.replace when the entry has a forwardUrl", async () => {
    const replace = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...orig, replace },
    });
    setSnapshot({ "qr-003": { pageSlug: null, forwardUrl: "https://example.org/x" } });
    renderAt("/q/qr-003");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("https://example.org/x"));
    expect(qrApi.sendScanBeacon).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, "location", { configurable: true, value: orig });
  });

  it("goes to / when the tag is absent from qrCodes", async () => {
    setSnapshot({});
    const { getByTestId } = renderAt("/q/qr-999");
    await waitFor(() => expect(getByTestId("location").textContent).toBe("/"));
    expect(qrApi.sendScanBeacon).toHaveBeenCalledTimes(1);
    expect(qrApi.sendScanBeacon).toHaveBeenCalledWith("qr-999", "https://ref.example/");
  });

  it("renders NotFound and sends no beacon for a malformed tag", () => {
    setSnapshot({ "qr-001": { pageSlug: "sponsors", forwardUrl: null } });
    const { container } = renderAt("/q/not-a-tag");
    expect(container.textContent).toMatch(/not found|404/i);
    expect(qrApi.sendScanBeacon).not.toHaveBeenCalled();
  });
});
