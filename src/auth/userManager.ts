// docs/site.md section 11.1. The oidc-client-ts module only enters the
// bundle through this file, via a dynamic import(). Callers await
// getUserManager(); a stored session lookup is a synchronous key
// existence check, used at boot in main.tsx.

import { env } from "../config/env";

// Note: type-only import so `oidc-client-ts` stays out of the main chunk.
import type { UserManager, User } from "oidc-client-ts";

let manager: UserManager | null = null;
let modulePromise: Promise<typeof import("oidc-client-ts")> | null = null;

async function loadModule(): Promise<typeof import("oidc-client-ts")> {
  modulePromise ??= import("oidc-client-ts");
  return modulePromise;
}

export async function getUserManager(): Promise<UserManager> {
  if (manager !== null) return manager;
  const mod = await loadModule();
  manager = new mod.UserManager({
    authority: env.COGNITO_AUTHORITY,
    client_id: env.COGNITO_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    automaticSilentRenew: true,
    userStore: new mod.WebStorageStateStore({ store: window.localStorage }),
    loadUserInfo: false,
    monitorSession: false,
  });
  return manager;
}

export const STORAGE_KEY_PREFIX = "oidc.user:";

export function hasStoredSession(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const authority = env.COGNITO_AUTHORITY;
    const clientId = env.COGNITO_CLIENT_ID;
    const key = `${STORAGE_KEY_PREFIX}${authority}:${clientId}`;
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function _resetUserManagerForTests(): void {
  manager = null;
  modulePromise = null;
}

export type { User };
