// docs/site.md section 11.2. When a visitor arrives at /auth/confirm
// straight from /auth/sign-up in the same tab, the sign-up page kept the
// password in memory so the confirm page can call signIn directly and land
// on returnTo. This module holds the reference in module state; it never
// hits storage.

let pending: { email: string; password: string } | null = null;

export function setPendingSignUp(email: string, password: string): void {
  pending = { email, password };
}

export function takePendingSignUp(email: string): string | null {
  if (pending !== null && pending.email === email) {
    const pw = pending.password;
    pending = null;
    return pw;
  }
  return null;
}

export function clearPendingSignUp(): void {
  pending = null;
}
