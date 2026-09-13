// docs/site.md 11.1 and 22.1: each wrapper call maps to the SDK method;
// every error name maps to its copy; sign-in stores tokens; getIdToken
// refreshes inside the last minute and throws SignInRequired when the
// refresh fails.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  const signUpMock = vi.fn();
  const confirmRegistrationMock = vi.fn();
  const resendConfirmationCodeMock = vi.fn();
  const authenticateUserMock = vi.fn();
  const forgotPasswordMock = vi.fn();
  const confirmPasswordMock = vi.fn();
  const refreshSessionMock = vi.fn();

  class CognitoUserPool {
    signUp = signUpMock;
  }
  class CognitoUser {
    setAuthenticationFlowType() {}
    confirmRegistration = confirmRegistrationMock;
    resendConfirmationCode = resendConfirmationCodeMock;
    authenticateUser = authenticateUserMock;
    forgotPassword = forgotPasswordMock;
    confirmPassword = confirmPasswordMock;
    refreshSession = refreshSessionMock;
  }
  class AuthenticationDetails {}
  class CognitoUserAttribute {
    data: { Name: string; Value: string };
    constructor(data: { Name: string; Value: string }) {
      this.data = data;
    }
  }
  class CognitoRefreshToken {
    data: { RefreshToken: string };
    constructor(data: { RefreshToken: string }) {
      this.data = data;
    }
  }

  return {
    signUpMock,
    confirmRegistrationMock,
    resendConfirmationCodeMock,
    authenticateUserMock,
    forgotPasswordMock,
    confirmPasswordMock,
    refreshSessionMock,
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
    CognitoUserAttribute,
    CognitoRefreshToken,
  };
});

vi.mock("amazon-cognito-identity-js", () => ({
  CognitoUserPool: mocks.CognitoUserPool,
  CognitoUser: mocks.CognitoUser,
  AuthenticationDetails: mocks.AuthenticationDetails,
  CognitoUserAttribute: mocks.CognitoUserAttribute,
  CognitoRefreshToken: mocks.CognitoRefreshToken,
}));

import { cognito, _resetPoolForTests } from "../../../src/auth/cognito";
import {
  session,
  getIdToken,
  SignInRequired,
  _resetSessionForTests,
} from "../../../src/auth/session";
import {
  signInMessage,
  signUpMessage,
  confirmMessage,
  resetMessage,
  isUserNotConfirmed,
} from "../../../src/auth/errors";
import { copy } from "../../../src/copy/copy";

function fakeSession(idExp: number) {
  return {
    getIdToken: () => ({
      getJwtToken: () => "id-jwt",
      getExpiration: () => Math.floor(idExp / 1000),
      decodePayload: () => ({ sub: "sub-1", email: "person@example" }),
    }),
    getAccessToken: () => ({ getJwtToken: () => "a-jwt" }),
    getRefreshToken: () => ({ getToken: () => "r-jwt" }),
    isValid: () => true,
  };
}

beforeEach(() => {
  _resetPoolForTests();
  _resetSessionForTests();
  for (const m of Object.values(mocks)) {
    if (typeof m === "function" && "mockReset" in m) (m as ReturnType<typeof vi.fn>).mockReset();
  }
});
afterEach(() => {
  _resetPoolForTests();
  _resetSessionForTests();
});

describe("cognito wrapper", () => {
  it("signUp calls pool.signUp with the email attribute", async () => {
    mocks.signUpMock.mockImplementationOnce((_u, _p, _attrs, _v, cb) => cb(null, {}));
    await cognito.signUp("A@Example.com", "p".repeat(12));
    expect(mocks.signUpMock).toHaveBeenCalled();
    const attrs = mocks.signUpMock.mock.calls[0][2];
    expect(attrs[0].data.Name).toBe("email");
  });

  it("confirm calls CognitoUser.confirmRegistration", async () => {
    mocks.confirmRegistrationMock.mockImplementationOnce((_c, _f, cb) => cb(null, "SUCCESS"));
    await cognito.confirm("a@e.com", "123456");
    expect(mocks.confirmRegistrationMock).toHaveBeenCalled();
  });

  it("resendCode calls CognitoUser.resendConfirmationCode", async () => {
    mocks.resendConfirmationCodeMock.mockImplementationOnce((cb) => cb(null));
    await cognito.resendCode("a@e.com");
    expect(mocks.resendConfirmationCodeMock).toHaveBeenCalled();
  });

  it("signIn resolves with tokens (authenticateUser onSuccess)", async () => {
    const exp = Date.now() + 3600_000;
    mocks.authenticateUserMock.mockImplementationOnce((_a, cb) => cb.onSuccess(fakeSession(exp)));
    const tokens = await cognito.signIn("a@e.com", "p".repeat(12));
    expect(tokens.idToken).toBe("id-jwt");
    expect(tokens.refreshToken).toBe("r-jwt");
    expect(tokens.email).toBe("person@example");
    expect(tokens.sub).toBe("sub-1");
  });

  it("signIn rejects with the raw error (UserNotConfirmedException)", async () => {
    const err = Object.assign(new Error("nope"), { name: "UserNotConfirmedException" });
    mocks.authenticateUserMock.mockImplementationOnce((_a, cb) => cb.onFailure(err));
    await expect(cognito.signIn("a@e.com", "p".repeat(12))).rejects.toBe(err);
  });

  it("forgot calls CognitoUser.forgotPassword", async () => {
    mocks.forgotPasswordMock.mockImplementationOnce((cbs) => cbs.onSuccess({}));
    await cognito.forgot("a@e.com");
    expect(mocks.forgotPasswordMock).toHaveBeenCalled();
  });

  it("reset calls CognitoUser.confirmPassword", async () => {
    mocks.confirmPasswordMock.mockImplementationOnce((_c, _p, cbs) => cbs.onSuccess("SUCCESS"));
    await cognito.reset("a@e.com", "123456", "p".repeat(12));
    expect(mocks.confirmPasswordMock).toHaveBeenCalled();
  });

  it("refresh resolves with new tokens", async () => {
    const exp = Date.now() + 3600_000;
    mocks.refreshSessionMock.mockImplementationOnce((_t, cb) => cb(null, fakeSession(exp)));
    const tokens = await cognito.refresh("person@example", "old-refresh");
    expect(tokens.idToken).toBe("id-jwt");
  });
});

describe("auth error map (docs 11.1)", () => {
  it("UserNotFoundException and NotAuthorizedException both map to wrong-credentials", () => {
    expect(signInMessage({ name: "UserNotFoundException" })).toBe(copy.auth.signIn.wrongCredentials);
    expect(signInMessage({ name: "NotAuthorizedException" })).toBe(copy.auth.signIn.wrongCredentials);
  });

  it("UserNotConfirmedException is detected for the routing branch", () => {
    expect(isUserNotConfirmed({ name: "UserNotConfirmedException" })).toBe(true);
    expect(isUserNotConfirmed({ name: "NotAuthorizedException" })).toBe(false);
  });

  it("UsernameExistsException maps to the sign-up 'already registered' line", () => {
    expect(signUpMessage({ name: "UsernameExistsException" })).toBe(copy.auth.signUp.alreadyExists);
  });

  it("CodeMismatchException / ExpiredCodeException name the code", () => {
    expect(confirmMessage({ name: "CodeMismatchException" })).toBe(copy.auth.confirm.codeBad);
    expect(confirmMessage({ name: "ExpiredCodeException" })).toBe(copy.auth.confirm.codeExpired);
    expect(resetMessage({ name: "CodeMismatchException" })).toBe(copy.auth.reset.codeBad);
  });

  it("InvalidPasswordException maps to the pool's password rule (sign-up)", () => {
    expect(signUpMessage({ name: "InvalidPasswordException" })).toBe(copy.auth.signUp.invalidPassword);
  });

  it("LimitExceeded / TooManyRequests read 'Too many attempts, wait a minute'", () => {
    expect(signInMessage({ name: "LimitExceededException" })).toBe(copy.auth.errors.tooMany);
    expect(signInMessage({ name: "TooManyRequestsException" })).toBe(copy.auth.errors.tooMany);
    expect(signUpMessage({ name: "TooManyRequestsException" })).toBe(copy.auth.errors.tooMany);
  });

  it("anything else is the generic line", () => {
    expect(signInMessage({ name: "MysteryException" })).toBe(copy.auth.errors.generic);
    expect(signUpMessage({ name: "MysteryException" })).toBe(copy.auth.errors.generic);
  });
});

describe("session + getIdToken (docs 11.4)", () => {
  const baseTokens = {
    idToken: "id-original",
    accessToken: "a",
    refreshToken: "r",
    email: "person@example",
    sub: "s",
  };

  it("returns the current id token when not near expiry", async () => {
    session.set({ ...baseTokens, idExpiresAt: Date.now() + 10 * 60_000 });
    const tok = await getIdToken();
    expect(tok).toBe("id-original");
    expect(mocks.refreshSessionMock).not.toHaveBeenCalled();
  });

  it("refreshes inside the last minute and stores the new tokens", async () => {
    session.set({ ...baseTokens, idExpiresAt: Date.now() + 30_000 });
    mocks.refreshSessionMock.mockImplementationOnce((_t, cb) =>
      cb(null, fakeSession(Date.now() + 3600_000)),
    );
    const tok = await getIdToken();
    expect(tok).toBe("id-jwt");
    expect(session.current()?.idToken).toBe("id-jwt");
  });

  it("throws SignInRequired when the refresh fails and clears the session", async () => {
    session.set({ ...baseTokens, idExpiresAt: Date.now() + 30_000 });
    mocks.refreshSessionMock.mockImplementationOnce((_t, cb) =>
      cb(new Error("boom"), undefined),
    );
    await expect(getIdToken()).rejects.toBeInstanceOf(SignInRequired);
    expect(session.current()).toBeNull();
  });

  it("throws SignInRequired when no session is stored", async () => {
    await expect(getIdToken()).rejects.toBeInstanceOf(SignInRequired);
  });

  it("sign-in stores tokens through session.set", async () => {
    const exp = Date.now() + 3600_000;
    mocks.authenticateUserMock.mockImplementationOnce((_a, cb) => cb.onSuccess(fakeSession(exp)));
    const tokens = await cognito.signIn("a@e.com", "p".repeat(12));
    session.set(tokens);
    expect(session.current()?.idToken).toBe("id-jwt");
  });
});
