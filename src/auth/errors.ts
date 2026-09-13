// docs/site.md section 11.1. Cognito error name to site copy, never the
// SDK's message. Callers get one of these shapes so no account enumeration
// leaks on sign-in and forgot-password.

import { copy } from "../copy/copy";

export type AuthErrorName =
  | "UserNotFoundException"
  | "NotAuthorizedException"
  | "UserNotConfirmedException"
  | "UsernameExistsException"
  | "CodeMismatchException"
  | "ExpiredCodeException"
  | "InvalidPasswordException"
  | "LimitExceededException"
  | "TooManyRequestsException"
  | "PasswordResetRequiredException"
  | "InvalidParameterException"
  | "Unknown";

export function errorName(err: unknown): AuthErrorName {
  if (err && typeof err === "object") {
    const n = (err as { name?: unknown; code?: unknown }).name;
    if (typeof n === "string") return n as AuthErrorName;
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string") return c as AuthErrorName;
  }
  return "Unknown";
}

export function signInMessage(err: unknown): string {
  const n = errorName(err);
  // No account enumeration on sign-in: both map to the same line.
  if (n === "UserNotFoundException" || n === "NotAuthorizedException") {
    return copy.auth.signIn.wrongCredentials;
  }
  if (n === "LimitExceededException" || n === "TooManyRequestsException") {
    return copy.auth.errors.tooMany;
  }
  return copy.auth.errors.generic;
}

export function signUpMessage(err: unknown): string {
  const n = errorName(err);
  if (n === "UsernameExistsException") return copy.auth.signUp.alreadyExists;
  if (n === "InvalidPasswordException") return copy.auth.signUp.invalidPassword;
  if (n === "LimitExceededException" || n === "TooManyRequestsException") {
    return copy.auth.errors.tooMany;
  }
  return copy.auth.errors.generic;
}

export function confirmMessage(err: unknown): string {
  const n = errorName(err);
  if (n === "CodeMismatchException") return copy.auth.confirm.codeBad;
  if (n === "ExpiredCodeException") return copy.auth.confirm.codeExpired;
  if (n === "LimitExceededException" || n === "TooManyRequestsException") {
    return copy.auth.errors.tooMany;
  }
  return copy.auth.errors.generic;
}

// The forgot flow shows the same copy whether or not the address exists,
// so success and any error land on the "we emailed you a code" screen;
// only the rate-limit error deviates.
export function forgotMessage(err: unknown): string | null {
  const n = errorName(err);
  if (n === "LimitExceededException" || n === "TooManyRequestsException") {
    return copy.auth.errors.tooMany;
  }
  return null;
}

export function resetMessage(err: unknown): string {
  const n = errorName(err);
  if (n === "CodeMismatchException") return copy.auth.reset.codeBad;
  if (n === "ExpiredCodeException") return copy.auth.reset.codeExpired;
  if (n === "InvalidPasswordException") return copy.auth.signUp.invalidPassword;
  if (n === "LimitExceededException" || n === "TooManyRequestsException") {
    return copy.auth.errors.tooMany;
  }
  return copy.auth.errors.generic;
}

export function isUserNotConfirmed(err: unknown): boolean {
  return errorName(err) === "UserNotConfirmedException";
}
