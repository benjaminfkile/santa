// docs/site.md section 22.1 rows for hub, driven by a fake HubConnection.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/config/env", () => ({
  env: {
    ENV: "preview",
    CDN_BASE_URL: "https://cdn.example",
    HUB_URL: "wss://hub.example/hub",
    HUB_CHANNEL_PREFIX: "wmsfo-api-dev",
    API_BASE_URL: "https://api.example",
    COGNITO_AUTHORITY: "https://cognito.example/authority",
    COGNITO_DOMAIN: "https://cognito.example",
    COGNITO_CLIENT_ID: "clientid",
    GOOGLE_MAPS_KEY: "key",
    ANALYTICS_ID: "",
    ANALYTICS_ORIGINS: [] as string[],
  },
  LIVE_URL: "https://cdn.example/live/location.json",
  LOCATION_CHANNEL: "wmsfo-api-dev:location",
  IS_PRODUCTION: false,
}));

import { createStore } from "../../src/store/store";
import { initialStore } from "../../src/store/types";
import type { HubConnectionLike, HubEnvelope } from "../../src/store/hub";
import { startHub, _resetHubForTests } from "../../src/store/hub";

class FakeHubConnection implements HubConnectionLike {
  handlers: Record<string, (e: HubEnvelope) => void> = {};
  onReconnectingCb: ((e?: Error) => void) | null = null;
  onReconnectedCb: ((id?: string) => void | Promise<void>) | null = null;
  onCloseCb: ((e?: Error) => void) | null = null;
  startCalls = 0;
  nextStart: () => Promise<void> = () => Promise.resolve();
  invocations: Array<{ method: string; args: unknown[] }> = [];
  nextInvoke: () => Promise<unknown> = () => Promise.resolve();
  stopped = false;

  on(name: string, handler: (envelope: HubEnvelope) => void): void {
    this.handlers[name] = handler;
  }
  onreconnecting(handler: (error?: Error) => void): void {
    this.onReconnectingCb = handler;
  }
  onreconnected(handler: (id?: string) => void | Promise<void>): void {
    this.onReconnectedCb = handler;
  }
  onclose(handler: (error?: Error) => void): void {
    this.onCloseCb = handler;
  }
  start(): Promise<void> {
    this.startCalls += 1;
    return this.nextStart();
  }
  stop(): Promise<void> {
    this.stopped = true;
    return Promise.resolve();
  }
  invoke(method: string, ...args: unknown[]): Promise<unknown> {
    this.invocations.push({ method, args });
    return this.nextInvoke();
  }

  emit(envelope: HubEnvelope): void {
    this.handlers["ChannelEvent"]?.(envelope);
  }
  emitReconnecting(): void {
    this.onReconnectingCb?.();
  }
  emitReconnected(): Promise<void> {
    const r = this.onReconnectedCb?.();
    return Promise.resolve(r);
  }
  emitClose(): void {
    this.onCloseCb?.();
  }
}

const CHANNEL = "wmsfo-api-dev:location";

beforeEach(() => {
  vi.useFakeTimers();
  _resetHubForTests();
});

afterEach(() => {
  _resetHubForTests();
  vi.useRealTimers();
});

async function flush(): Promise<void> {
  // Let queued microtasks run.
  await vi.advanceTimersByTimeAsync(0);
}

describe("hub", () => {
  it("registers handlers before start()", async () => {
    const conn = new FakeHubConnection();
    let startResolved = false;
    conn.nextStart = () => {
      // At the moment start() is called, handlers must already be attached.
      expect(conn.handlers["ChannelEvent"]).toBeDefined();
      expect(conn.onReconnectingCb).not.toBeNull();
      expect(conn.onReconnectedCb).not.toBeNull();
      expect(conn.onCloseCb).not.toBeNull();
      startResolved = true;
      return Promise.resolve();
    };
    const store = createStore({ ...initialStore });
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    expect(startResolved).toBe(true);
  });

  it("sets connected only on the joined ack, not when start() resolves", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    conn.nextInvoke = () => Promise.resolve();
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    // start() has resolved, JoinChannel has been invoked, but joined ack not received.
    expect(store.getState().hub).toBe("connecting");
    conn.emit({ channel: CHANNEL, event: "joined" });
    expect(store.getState().hub).toBe("connected");
  });

  it("transitions to reconnecting on onreconnecting, and disconnected then reconnecting on onclose", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    conn.nextInvoke = () => Promise.resolve();
    const seen: string[] = [];
    const unsub = store.subscribe(() => seen.push(store.getState().hub));
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    conn.emit({ channel: CHANNEL, event: "joined" });
    conn.emitReconnecting();
    expect(store.getState().hub).toBe("reconnecting");
    conn.emitClose();
    // onclose sets disconnected, then the restart loop sets connecting.
    expect(seen).toContain("disconnected");
    unsub();
  });

  it("re-joins and calls pollNow on onreconnected", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    const pollNow = vi.fn();
    conn.nextInvoke = () => Promise.resolve();
    void startHub({ store, pollNow, build: () => Promise.resolve(conn) });
    await flush();
    conn.emit({ channel: CHANNEL, event: "joined" });
    conn.invocations = [];
    await conn.emitReconnected();
    await flush();
    expect(conn.invocations[0]?.method).toBe("JoinChannel");
    expect(pollNow).toHaveBeenCalledTimes(1);
  });

  it("channelEvicted auth_expired re-joins and polls immediately", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    const pollNow = vi.fn();
    conn.nextInvoke = () => Promise.resolve();
    void startHub({ store, pollNow, build: () => Promise.resolve(conn) });
    await flush();
    conn.emit({ channel: CHANNEL, event: "joined" });
    conn.invocations = [];
    conn.emit({ channel: CHANNEL, event: "channelEvicted", data: { reason: "auth_expired" } });
    await flush();
    expect(conn.invocations[0]?.method).toBe("JoinChannel");
    expect(pollNow).toHaveBeenCalledTimes(1);
  });

  it("channelEvicted service_removed retries join every 5 s", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    let invokeAttempts = 0;
    conn.nextInvoke = () => {
      invokeAttempts += 1;
      if (invokeAttempts === 1) return Promise.resolve(); // initial join succeeds
      if (invokeAttempts === 2) return Promise.reject(new Error("still removed"));
      return Promise.resolve();
    };
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    conn.emit({ channel: CHANNEL, event: "joined" });
    expect(invokeAttempts).toBe(1);
    conn.emit({ channel: CHANNEL, event: "channelEvicted", data: { reason: "service_removed" } });
    // Wait 5 s → first retry
    await vi.advanceTimersByTimeAsync(5000);
    expect(invokeAttempts).toBe(2);
    // Wait another 5 s → next retry that succeeds
    await vi.advanceTimersByTimeAsync(5000);
    expect(invokeAttempts).toBe(3);
  });

  it("denied join waits 10 s before the first retry", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    let joinAttempts = 0;
    conn.nextInvoke = () => {
      joinAttempts += 1;
      if (joinAttempts === 1) return Promise.reject(new Error("denied"));
      return Promise.resolve();
    };
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    expect(joinAttempts).toBe(1);
    // Not yet retried after 9 s.
    await vi.advanceTimersByTimeAsync(9000);
    expect(joinAttempts).toBe(1);
    // Retried after 10 s.
    await vi.advanceTimersByTimeAsync(1500);
    expect(joinAttempts).toBe(2);
  });

  it("throttled join uses the short 1, 2, 3 s backoff", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    let joinAttempts = 0;
    conn.nextInvoke = () => {
      joinAttempts += 1;
      if (joinAttempts < 3) return Promise.reject(new Error("throttled by rate limiter"));
      return Promise.resolve();
    };
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    expect(joinAttempts).toBe(1);
    // 1000 ms → attempt 2
    await vi.advanceTimersByTimeAsync(1000);
    expect(joinAttempts).toBe(2);
    // 2000 ms → attempt 3
    await vi.advanceTimersByTimeAsync(2000);
    expect(joinAttempts).toBe(3);
  });

  it("onclose restarts the start loop", async () => {
    const conn = new FakeHubConnection();
    const store = createStore({ ...initialStore });
    conn.nextInvoke = () => Promise.resolve();
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn) });
    await flush();
    const startsBefore = conn.startCalls;
    conn.emitClose();
    await flush();
    expect(conn.startCalls).toBe(startsBefore + 1);
  });

  it("a second startHub is a no-op", async () => {
    const conn1 = new FakeHubConnection();
    conn1.nextInvoke = () => Promise.resolve();
    const store = createStore({ ...initialStore });
    void startHub({ store, pollNow: () => {}, build: () => Promise.resolve(conn1) });
    await flush();
    const conn2 = new FakeHubConnection();
    conn2.nextInvoke = () => Promise.resolve();
    let build2Called = false;
    await startHub({
      store,
      pollNow: () => {},
      build: () => {
        build2Called = true;
        return Promise.resolve(conn2);
      },
    });
    expect(build2Called).toBe(false);
    expect(conn2.startCalls).toBe(0);
  });
});
