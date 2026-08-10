import assert from "node:assert/strict";
import test from "node:test";
import {
  generateAgentApiKey,
  hashAgentApiKey,
  verifyAgentApiKey,
} from "../src/agent-credentials.js";

const PEPPER = "a-development-only-pepper-with-more-than-32-bytes";

test("generates a lookup-safe prefix and stores only a keyed digest", () => {
  const key = generateAgentApiKey("test", PEPPER);
  assert.match(key.secret, /^ags_test_[A-Za-z0-9_-]{43}$/);
  assert.equal(key.prefix, key.secret.slice(0, 20));
  assert.match(key.hash, /^v1:[a-f0-9]{64}$/);
  assert.equal(key.hash.includes(key.secret), false);
  assert.equal(verifyAgentApiKey(key.secret, key.hash, PEPPER), true);
});

test("verification fails for changed secret, digest or pepper", () => {
  const key = generateAgentApiKey("live", PEPPER);
  const other = generateAgentApiKey("live", PEPPER);
  assert.equal(verifyAgentApiKey(other.secret, key.hash, PEPPER), false);
  assert.equal(verifyAgentApiKey(key.secret, `${key.hash}00`, PEPPER), false);
  assert.equal(
    verifyAgentApiKey(key.secret, key.hash, "a-different-development-pepper-over-32-bytes"),
    false,
  );
});

test("rejects weak pepper and malformed key material", () => {
  assert.throws(() => generateAgentApiKey("test", "too-short"), RangeError);
  assert.throws(() => hashAgentApiKey("not-an-agent-key", PEPPER), TypeError);
  assert.equal(verifyAgentApiKey("not-an-agent-key", "v1:00", PEPPER), false);
});

