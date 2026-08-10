import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AgentApiKeyMode = "test" | "live";

export interface GeneratedAgentApiKey {
  /** Returned once. Never persist or log this value. */
  readonly secret: string;
  /** Safe identifier for lookup and operator UI. */
  readonly prefix: string;
  /** HMAC digest stored in the database. */
  readonly hash: string;
}

function assertPepper(pepper: string): void {
  if (Buffer.byteLength(pepper, "utf8") < 32) {
    throw new RangeError("AGENTSAFE_API_KEY_PEPPER must contain at least 32 bytes");
  }
}

export function hashAgentApiKey(secret: string, pepper: string): string {
  assertPepper(pepper);
  if (!/^ags_(test|live)_[A-Za-z0-9_-]{43}$/.test(secret)) {
    throw new TypeError("invalid AgentSafe API key format");
  }
  return `v1:${createHmac("sha256", pepper).update(secret, "utf8").digest("hex")}`;
}

export function generateAgentApiKey(mode: AgentApiKeyMode, pepper: string): GeneratedAgentApiKey {
  assertPepper(pepper);
  const secret = `ags_${mode}_${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    prefix: secret.slice(0, 20),
    hash: hashAgentApiKey(secret, pepper),
  };
}

export function verifyAgentApiKey(secret: string, storedHash: string, pepper: string): boolean {
  let candidate: string;
  try {
    candidate = hashAgentApiKey(secret, pepper);
  } catch {
    return false;
  }
  const left = Buffer.from(candidate, "utf8");
  const right = Buffer.from(storedHash, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

