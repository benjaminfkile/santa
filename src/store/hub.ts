// docs/site.md section 6.3. WebSockets-only SignalR hub, dynamically imported
// from loop.ts. Handlers register before `start()`; `connected` is set only
// on the `joined` ack. Two backoff classes: throttling errors use the short
// 1, 2, 3, 5 s backoff, other rejections wait 10 s first.

import { store as defaultStore, type StoreHandle } from "./store";
import { applyIncomingLive } from "./loop";
import { backoffAt } from "./backoff";
import { env, LOCATION_CHANNEL } from "../config/env";

export type HubEnvelope = {
  channel?: string;
  event?: string;
  data?: unknown;
};

export interface HubConnectionLike {
  on(name: string, handler: (envelope: HubEnvelope) => void): void;
  onreconnecting(handler: (error?: Error) => void): void;
  onreconnected(handler: (connectionId?: string) => void | Promise<void>): void;
  onclose(handler: (error?: Error) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke(method: string, ...args: unknown[]): Promise<unknown>;
  keepAliveIntervalInMilliseconds?: number;
  serverTimeoutInMilliseconds?: number;
}

export type HubBuilder = () => Promise<HubConnectionLike>;

export type HubDeps = {
  store?: StoreHandle;
  pollNow: () => void;
  now?: () => number;
  channel?: string;
  build?: HubBuilder;
};

let started = false;
let stopping = false;

async function defaultBuild(): Promise<HubConnectionLike> {
  const signalR = await import("@microsoft/signalr");
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(env.HUB_URL, {
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([1000, 2000, 3000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000])
    .configureLogging(signalR.LogLevel.Warning)
    .build() as unknown as HubConnectionLike;
  connection.keepAliveIntervalInMilliseconds = 15000;
  connection.serverTimeoutInMilliseconds = 30000;
  return connection;
}

function isThrottleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /throttl|budget|rate/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Starts the hub. Idempotent per module (second call is a no-op).
 */
export async function startHub(deps: HubDeps): Promise<void> {
  if (started) return;
  started = true;
  stopping = false;

  const store = deps.store ?? defaultStore;
  const now = deps.now ?? (() => performance.now());
  const channel = deps.channel ?? LOCATION_CHANNEL;
  const build = deps.build ?? defaultBuild;
  const pollNow = deps.pollNow;

  const connection = await build();

  connection.on("ChannelEvent", (envelope) => {
    if (!envelope || envelope.channel !== channel) return;
    switch (envelope.event) {
      case "location": {
        // Same path as a poll: apply, then fetch the snapshot and route the
        // new live object points at (site.md 6.4).
        void applyIncomingLive(store, envelope.data, now).then(() => {
          store.setState((s) => ({ ...s, lastHubLocationAt: now() }));
        });
        break;
      }
      case "joined": {
        store.setState({ hub: "connected" });
        break;
      }
      case "channelEvicted": {
        const data = envelope.data as { reason?: string } | null | undefined;
        void handleEviction(data?.reason);
        break;
      }
      default:
        break;
    }
  });

  connection.onreconnecting(() => {
    store.setState({ hub: "reconnecting" });
  });

  connection.onreconnected(async () => {
    await join();
    pollNow();
  });

  connection.onclose(() => {
    store.setState({ hub: "disconnected" });
    if (stopping) return;
    void startLoop();
  });

  await startLoop();

  async function startLoop(): Promise<void> {
    let attempt = 0;
    while (!stopping) {
      store.setState({ hub: "connecting" });
      try {
        await connection.start();
        void join();
        return;
      } catch {
        await sleep(backoffAt(attempt));
        attempt += 1;
      }
    }
  }

  async function join(): Promise<void> {
    let attempt = 0;
    let waitedFirst10s = false;
    while (!stopping) {
      try {
        await connection.invoke("JoinChannel", channel);
        return;
      } catch (err) {
        if (isThrottleError(err)) {
          await sleep(backoffAt(attempt));
          attempt += 1;
        } else {
          if (!waitedFirst10s) {
            waitedFirst10s = true;
            await sleep(10000);
          } else {
            await sleep(backoffAt(attempt));
            attempt += 1;
          }
        }
      }
    }
  }

  async function handleEviction(reason: string | undefined): Promise<void> {
    if (reason === "auth_expired") {
      await join();
      pollNow();
      return;
    }
    if (reason === "service_removed") {
      while (!stopping) {
        await sleep(5000);
        try {
          await connection.invoke("JoinChannel", channel);
          return;
        } catch {
          // keep retrying every 5 s
        }
      }
    }
  }
}

export function _resetHubForTests(): void {
  started = false;
  stopping = false;
}
