// docs/site.md section 22.2. Drives sign-up to the "We emailed you a
// code" step for a throwaway `+tag` address, then deletes the unconfirmed
// user with AdminDeleteUser through the harness's AWS credentials. When
// the credentials are absent the caller skips the spec.

import { e2eEnv } from "./env";
import { adminAwsCredentials, hasAwsCredentials, signCognitoAdmin } from "./aws";

type LocatorLike = {
  first: () => LocatorLike;
  click: (options?: { timeout?: number }) => Promise<void>;
  fill: (value: string) => Promise<void>;
  waitFor: (options?: { state?: "visible" | "attached"; timeout?: number }) => Promise<void>;
};

type PageLike = {
  goto: (url: string) => Promise<unknown>;
  locator: (selector: string) => LocatorLike;
  getByText: (text: string | RegExp) => LocatorLike;
};

export type SignUpResult = { email: string };

export function makeThrowawayEmail(baseEmail: string): string {
  const at = baseEmail.indexOf("@");
  if (at < 0) throw new Error("E2E_PERSON_EMAIL is not a valid address");
  const local = baseEmail.slice(0, at);
  const domain = baseEmail.slice(at);
  const tag = `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const [head] = local.split("+");
  return `${head}+${tag}${domain}`;
}

export async function personSignUp(page: PageLike): Promise<SignUpResult> {
  const email = makeThrowawayEmail(e2eEnv.PERSON_EMAIL);
  await page.goto("/auth/sign-up");
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('input[name="confirmPassword"]').first().fill(e2eEnv.PERSON_PASSWORD);
  await page.locator('[data-testid="auth-submit"]').first().click();
  await page.getByText(/we emailed you a code/i).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  return { email };
}

export async function deleteUnconfirmedUser(email: string): Promise<void> {
  if (!hasAwsCredentials()) return;
  const region = process.env.E2E_COGNITO_REGION ?? "us-east-1";
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  const body = JSON.stringify({
    UserPoolId: process.env.E2E_COGNITO_USER_POOL_ID,
    Username: email,
  });
  const req = signCognitoAdmin({
    method: "POST",
    endpoint,
    region,
    target: "AWSCognitoIdentityProviderService.AdminDeleteUser",
    body,
    creds: adminAwsCredentials(),
  });
  const res = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: req.body,
  });
  if (!res.ok) {
    throw new Error(`AdminDeleteUser failed: ${res.status} ${await res.text()}`);
  }
}

export { hasAwsCredentials };
