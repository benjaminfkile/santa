// docs/site.md section 22.2. Minimal AWS SigV4 signer for the Cognito
// admin call used by personSignUp.ts (AdminDeleteUser). The harness's
// AWS credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY,
// with an optional AWS_SESSION_TOKEN.

import { createHash, createHmac } from "node:crypto";

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export function hasAwsCredentials(): boolean {
  return (
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY &&
    !!process.env.E2E_COGNITO_USER_POOL_ID
  );
}

export function adminAwsCredentials(): AwsCredentials {
  const ak = process.env.AWS_ACCESS_KEY_ID ?? "";
  const sk = process.env.AWS_SECRET_ACCESS_KEY ?? "";
  const st = process.env.AWS_SESSION_TOKEN;
  if (ak === "" || sk === "") throw new Error("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are required");
  return { accessKeyId: ak, secretAccessKey: sk, sessionToken: st };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export type SignArgs = {
  method: "POST";
  endpoint: string;
  region: string;
  target: string;
  body: string;
  creds: AwsCredentials;
};

export type SignedRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

// SigV4 for the Cognito Identity Provider admin call.
export function signCognitoAdmin(args: SignArgs): SignedRequest {
  const url = new URL(args.endpoint);
  const service = "cognito-idp";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const contentType = "application/x-amz-json-1.1";
  const host = url.host;

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    Host: host,
    "X-Amz-Date": amzDate,
    "X-Amz-Target": args.target,
  };
  if (args.creds.sessionToken) headers["X-Amz-Security-Token"] = args.creds.sessionToken;

  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders =
    signedHeaderKeys
      .map((k) => {
        const originalKey = Object.keys(headers).find((h) => h.toLowerCase() === k) as string;
        return `${k}:${headers[originalKey].trim()}`;
      })
      .join("\n") + "\n";
  const signedHeaders = signedHeaderKeys.join(";");
  const payloadHash = sha256Hex(args.body);
  const canonicalRequest = [
    args.method,
    url.pathname === "" ? "/" : url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${args.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${args.creds.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, args.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${args.creds.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: url.toString(),
    headers: { ...headers, Authorization: authorization },
    body: args.body,
  };
}
