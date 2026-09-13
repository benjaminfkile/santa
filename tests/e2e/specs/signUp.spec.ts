// docs/site.md section 22.2 personSignUp helper. Drives sign-up to the
// "We emailed you a code" step for a throwaway `+tag` address, then
// deletes the unconfirmed user with AdminDeleteUser through the harness's
// AWS credentials. Skipped when the credentials are absent.

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
