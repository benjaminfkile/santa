// docs/site.md section 22.2 personSignUp helper. Drives sign-up to the
// "We emailed you a code" step for a throwaway `+tag` address, then
// deletes the unconfirmed user with AdminDeleteUser through the harness's
// AWS credentials. Skipped when the credentials are absent. The alerts
// box (11.2), when the snapshot has subscriptions open, starts checked.

import { test, expect } from "@playwright/test";
import { assertDevApi, deleteUnconfirmedUser, hasAwsCredentials, personSignUp } from "../harness";

test.beforeAll(async () => {
  assertDevApi();
});

test.describe("person sign-up", () => {
  test.skip(!hasAwsCredentials(), "AWS credentials missing; the sign-up spec needs AdminDeleteUser");

  test("reaches the 'We emailed you a code' step and cleans up", async ({ page }) => {
    const { email } = await personSignUp(page);
    expect(email).toContain("+");
    // Clean up the unconfirmed user so the pool does not accumulate.
    await deleteUnconfirmedUser(email);
  });
});

test("the sign-up alerts box starts checked when shown", async ({ page }) => {
  await page.goto("/auth/sign-up");
  await page.locator('[data-testid="auth-submit"]').first().waitFor({ state: "visible" });
  const box = page.locator('[data-testid="auth-sign-up-alerts"]');
  if ((await box.count()) > 0) await expect(box.first()).toBeChecked();
});
