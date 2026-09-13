// docs/site.md section 11.1. Thin async wrapper over amazon-cognito-identity-js
// using SRP so the password never leaves the browser in clear. The pool's
// Storage is a small ICognitoStorage over lib/storage.ts so a person who
// signs in before the event stays signed in on event night.
//
// Every method resolves with the local domain object; errors surface with
// their raw Cognito error name so callers can map them to copy per 11.1.

import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
  type ICognitoStorage,
  type ISignUpResult,
} from "amazon-cognito-identity-js";
import { env, COGNITO_IDP_URL } from "../config/env";
import { storageGet, storageSet, storageRemove } from "../lib/storage";
import type { Tokens } from "./session";

export type { Tokens };

// ICognitoStorage over the guarded storage helpers so a blocked or missing
// localStorage never throws in the pool's constructor or on set.
const sessionStore: ICognitoStorage = {
  getItem(key: string) {
    return storageGet(key);
  },
  setItem(key: string, value: string) {
    storageSet(key, value);
  },
  removeItem(key: string) {
    storageRemove(key);
  },
  clear() {},
};

let poolCache: CognitoUserPool | null = null;
function pool(): CognitoUserPool {
  if (poolCache === null) {
    poolCache = new CognitoUserPool({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      ClientId: env.COGNITO_CLIENT_ID,
      Storage: sessionStore,
    });
  }
  return poolCache;
}

function user(email: string): CognitoUser {
  return new CognitoUser({ Username: email, Pool: pool(), Storage: sessionStore });
}

function toTokens(session: CognitoUserSession, email: string): Tokens {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload() as { sub?: unknown; email?: unknown };
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const claimedEmail = typeof payload.email === "string" ? payload.email : email;
  return {
    idToken: idToken.getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    email: claimedEmail,
    sub,
    idExpiresAt: idToken.getExpiration() * 1000,
  };
}

export type CognitoWrapper = {
  signUp: (email: string, password: string) => Promise<void>;
  confirm: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<Tokens>;
  forgot: (email: string) => Promise<void>;
  reset: (email: string, code: string, password: string) => Promise<void>;
  refresh: (email: string, refreshToken: string) => Promise<Tokens>;
  revoke: (refreshToken: string) => Promise<void>;
};

export const cognito: CognitoWrapper = {
  signUp(email, password) {
    const attrs = [new CognitoUserAttribute({ Name: "email", Value: email })];
    return new Promise<void>((resolve, reject) => {
      pool().signUp(email, password, attrs, [], (err, _result?: ISignUpResult) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  confirm(email, code) {
    return new Promise<void>((resolve, reject) => {
      user(email).confirmRegistration(code, true, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  resendCode(email) {
    return new Promise<void>((resolve, reject) => {
      user(email).resendConfirmationCode((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  signIn(email, password) {
    const auth = new AuthenticationDetails({ Username: email, Password: password });
    const cu = user(email);
    cu.setAuthenticationFlowType("USER_SRP_AUTH");
    return new Promise<Tokens>((resolve, reject) => {
      cu.authenticateUser(auth, {
        onSuccess: (session) => resolve(toTokens(session, email)),
        onFailure: (err) => reject(err),
      });
    });
  },
  forgot(email) {
    return new Promise<void>((resolve, reject) => {
      user(email).forgotPassword({
        onSuccess: () => resolve(),
        inputVerificationCode: () => resolve(),
        onFailure: (err) => reject(err),
      });
    });
  },
  reset(email, code, password) {
    return new Promise<void>((resolve, reject) => {
      user(email).confirmPassword(code, password, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
      });
    });
  },
  refresh(email, refreshToken) {
    const cu = user(email);
    const token = new CognitoRefreshToken({ RefreshToken: refreshToken });
    return new Promise<Tokens>((resolve, reject) => {
      cu.refreshSession(token, (err, session: CognitoUserSession | undefined) => {
        if (err || !session) {
          reject(err ?? new Error("refresh failed"));
          return;
        }
        resolve(toTokens(session, email));
      });
    });
  },
  async revoke(refreshToken) {
    // RevokeToken is a plain POST to the Cognito IdP; the SDK's revokeToken
    // API requires a live user session, so we do it directly to keep the
    // best-effort semantics.
    try {
      await fetch(`${COGNITO_IDP_URL}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "AWSCognitoIdentityProviderService.RevokeToken",
        },
        body: JSON.stringify({ ClientId: env.COGNITO_CLIENT_ID, Token: refreshToken }),
      });
    } catch {
      // best effort
    }
  },
};

export function _resetPoolForTests(): void {
  poolCache = null;
}
