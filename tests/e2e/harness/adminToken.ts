// docs/site.md section 22.2. Obtains an ID token for the E2E admin.
// Section 25 item 2 in the spec leaves the exact mechanism open; this
// module reads a preminted token from `E2E_ADMIN_ID_TOKEN` when set
// (the CI-friendly path), otherwise throws so the caller fails loudly.

export async function getAdminIdToken(): Promise<string> {
  const preminted = process.env.E2E_ADMIN_ID_TOKEN;
  if (preminted && preminted !== "") return preminted;
  throw new Error(
    "E2E_ADMIN_ID_TOKEN is not set. Provide a Cognito ID token for the E2E admin.",
  );
}
