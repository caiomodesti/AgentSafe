import { createHash } from "node:crypto";
import type { PaymentIntent } from "./domain.js";

function canonicalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString(10);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

/**
 * Hashes every security-relevant intent field using stable key ordering.
 * The result binds approvals and idempotency records to one exact request.
 */
export function hashPaymentIntent(intent: PaymentIntent): string {
  const encoded = JSON.stringify(canonicalize(intent));
  return createHash("sha256").update(encoded, "utf8").digest("hex");
}

