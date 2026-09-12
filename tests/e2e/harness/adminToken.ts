// docs/site.md section 22.2. Obtains an ID token for the E2E admin: a
// preminted `E2E_ADMIN_ID_TOKEN` when set, otherwise `InitiateAuth`
// (`USER_PASSWORD_AUTH`) on the dev admin pool's client named by
// `E2E_ADMIN_CLIENT_ID`, answering the `SOFTWARE_TOKEN_MFA` challenge with
// a TOTP computed from `E2E_ADMIN_TOTP_SECRET`. The token is minted once
// per process and reused.

import { createHmac } from "node:crypto";
import { e2eEnv } from "./env";

let minted: Promise<string> | null = null;

export async function getAdminIdToken(): Promise<string> {
  const preminted = process.env.E2E_ADMIN_ID_TOKEN;
  if (preminted && preminted !== "") return preminted;
  minted ??= mint();
  return minted;
}

type AuthResult = {
  ChallengeName?: string;
  Session?: string;
  AuthenticationResult?: { IdToken?: string };
};

async function mint(): Promise<string> {
  const clientId = e2eEnv.ADMIN_CLIENT_ID;
  const region = process.env.E2E_COGNITO_REGION ?? "us-east-1";
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;
  const call = async (target: string, body: unknown): Promise<AuthResult> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as AuthResult & { __type?: string; message?: string };
    if (!res.ok) throw new Error(`${target} failed: ${json.__type ?? res.status} ${json.message ?? ""}`);
    return json;
  };
  const first = await call("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: { USERNAME: e2eEnv.ADMIN_EMAIL, PASSWORD: e2eEnv.ADMIN_PASSWORD },
  });
  let result = first;
  if (first.ChallengeName === "SOFTWARE_TOKEN_MFA") {
    result = await call("RespondToAuthChallenge", {
      ClientId: clientId,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: first.Session,
      ChallengeResponses: {
        USERNAME: e2eEnv.ADMIN_EMAIL,
        SOFTWARE_TOKEN_MFA_CODE: totp(e2eEnv.ADMIN_TOTP_SECRET),
      },
    });
  } else if (first.ChallengeName) {
    throw new Error(`unexpected Cognito challenge ${first.ChallengeName} for the E2E admin`);
  }
  const token = result.AuthenticationResult?.IdToken;
  if (!token) throw new Error("Cognito returned no ID token for the E2E admin");
  return token;
}

// RFC 6238, six digits, 30 second step, SHA-1, base32 secret.
function totp(secret: string, at = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[=\s]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error("E2E_ADMIN_TOTP_SECRET is not base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
