// docs/site.md section 22.2. Reads the E2E environment. The harness
// refuses to run when E2E_API_BASE_URL does not contain "dev": the walk
// mutates event status and posts locations, and must never touch prod.
// E2E_BEACON_KEY is optional: the status walk creates and enrolls its
// own beacon per run; other specs that read it directly still work when
// it is set.
//
// The reads are lazy so `playwright test --list` (and other dry runs)
// can load the specs without the environment being set.

const REQUIRED_KEYS = [
  "BASE_URL",
  "API_BASE_URL",
  "CDN_BASE_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_TOTP_SECRET",
  "ADMIN_CLIENT_ID",
  "PERSON_EMAIL",
  "PERSON_PASSWORD",
] as const;

const OPTIONAL_KEYS = ["BEACON_KEY"] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];
type OptionalKey = (typeof OPTIONAL_KEYS)[number];
type Key = RequiredKey | OptionalKey;

function raw(name: Key): string {
  return process.env[`E2E_${name}`] ?? "";
}

function required(name: RequiredKey): string {
  const v = raw(name);
  if (v === "") throw new Error(`E2E_${name} is required`);
  return v;
}

export const e2eEnv = new Proxy({} as Record<Key, string>, {
  get(_target, prop: string) {
    if ((OPTIONAL_KEYS as readonly string[]).includes(prop)) return raw(prop as OptionalKey);
    if (!(REQUIRED_KEYS as readonly string[]).includes(prop)) return undefined;
    return required(prop as RequiredKey);
  },
});

export function assertDevApi(): void {
  const api = required("API_BASE_URL");
  if (!api.includes("dev")) {
    throw new Error(
      `E2E_API_BASE_URL must contain "dev"; refusing to run against ${api}`,
    );
  }
}
