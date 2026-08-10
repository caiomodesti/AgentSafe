import assert from "node:assert/strict";
import test from "node:test";
import { parseBaseUnits, remaining, wouldExceed } from "../src/money.js";

test("parses only canonical non-negative integer strings", () => {
  assert.equal(parseBaseUnits("0"), 0n);
  assert.equal(parseBaseUnits("1000000"), 1_000_000n);
  for (const invalid of ["", "01", "-1", "1.0", "1e6", " 1", "+1"]) {
    assert.throws(() => parseBaseUnits(invalid), TypeError);
  }
});

test("remaining never becomes negative and reservations count against limits", () => {
  assert.equal(remaining(10n, 4n, 3n), 3n);
  assert.equal(remaining(10n, 8n, 5n), 0n);
  assert.equal(wouldExceed(10n, 4n, 3n, 3n), false);
  assert.equal(wouldExceed(10n, 4n, 3n, 4n), true);
});

