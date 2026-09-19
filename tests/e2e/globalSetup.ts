// docs/site.md section 22.2. Runs once before every worker starts.
// Each Playwright worker is a separate process; when several workers mint
// their own Cognito ID token inside the same 30 second TOTP step, the
// second one gets `ExpiredCodeException: Your software token has already
// been used once`. Global setup mints one ID token here and hands it to
// every worker through `E2E_ADMIN_ID_TOKEN` in the process environment
// (workers inherit it from this process). When the required E2E variables
// are absent (`--list`, a unit run, a local dry check) it does nothing
// and does not throw.

import { getAdminIdToken } from "./harness/adminToken";

const REQUIRED = [
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_ADMIN_TOTP_SECRET",
  "E2E_ADMIN_CLIENT_ID",
];

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_ADMIN_ID_TOKEN) return;
  if (REQUIRED.some((k) => !process.env[k])) return;
  const token = await getAdminIdToken();
  process.env.E2E_ADMIN_ID_TOKEN = token;
}
