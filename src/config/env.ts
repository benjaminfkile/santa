// docs/site.md section 3. Reads and validates the VITE_ configuration.
// A missing or malformed value throws EnvError; main.tsx catches it and
// renders the "site misconfigured" page.

export class EnvError extends Error {
  variable: string;
  constructor(variable: string, message: string) {
    super(message);
    this.name = "EnvError";
    this.variable = variable;
  }
}

function raw(name: string): string {
  const bag = (import.meta.env ?? {}) as Record<string, unknown>;
  const v = bag[name];
  return typeof v === "string" ? v : "";
}

function read(name: string, pattern: RegExp): string {
  const v = raw(name);
  if (v === "") throw new EnvError(name, `${name} is not set`);
  if (!pattern.test(v)) throw new EnvError(name, `${name} does not match ${pattern}`);
  return v;
}

function readUrl(name: string, protocol: string): string {
  const v = read(name, /^\S+$/);
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new EnvError(name, `${name} is not a valid URL`);
  }
  if (u.protocol !== protocol) throw new EnvError(name, `${name} must use ${protocol}`);
  return v.replace(/\/+$/, "");
}

function readOptional(name: string): string {
  return raw(name);
}

export const env = {
  ENV: read("VITE_ENV", /^(production|preview)$/) as "production" | "preview",
  CDN_BASE_URL: readUrl("VITE_CDN_BASE_URL", "https:"),
  HUB_URL: readUrl("VITE_HUB_URL", "wss:"),
  HUB_CHANNEL_PREFIX: read("VITE_HUB_CHANNEL_PREFIX", /^[a-z0-9-]+$/),
  API_BASE_URL: readUrl("VITE_API_BASE_URL", "https:"),
  COGNITO_AUTHORITY: readUrl("VITE_COGNITO_AUTHORITY", "https:"),
  COGNITO_DOMAIN: readUrl("VITE_COGNITO_DOMAIN", "https:"),
  COGNITO_CLIENT_ID: read("VITE_COGNITO_CLIENT_ID", /^[a-z0-9]+$/),
  GOOGLE_MAPS_KEY: read("VITE_GOOGLE_MAPS_KEY", /^\S+$/),
  ANALYTICS_ID: readOptional("VITE_ANALYTICS_ID"),
  ANALYTICS_ORIGINS: readOptional("VITE_ANALYTICS_ORIGINS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export const LIVE_URL = `${env.CDN_BASE_URL}/live/location.json`;
export const LOCATION_CHANNEL = `${env.HUB_CHANNEL_PREFIX}:location`;
export const IS_PRODUCTION = env.ENV === "production";
