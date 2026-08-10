import assert from "node:assert/strict";
import test from "node:test";
import { calculateBlastRadius, compareBlastRadius } from "../src/blast-radius.js";

test("separates transaction, task and effective authorized exposure", () => {
  const result = calculateBlastRadius({
    treasuryAvailableBaseUnits: 10_000_000_000n,
    perTransactionRemainingBaseUnits: 2_000_000n,
    taskRemainingBaseUnits: 3_000_000n,
    dailyRemainingBaseUnits: 20_000_000n,
    lifetimeRemainingBaseUnits: 200_000_000n,
    onchainRemainingAllowanceBaseUnits: 20_000_000n,
  });

  assert.equal(result.perTransactionExposureBaseUnits, 2_000_000n);
  assert.equal(result.currentTaskExposureBaseUnits, 3_000_000n);
  assert.equal(result.effectiveMaximumAuthorizedExposureBaseUnits, 20_000_000n);
  assert.equal(result.treasuryOutsideAuthorityBps, 9_980);
});

test("onchain allowance is a hard upper bound and zero treasury is explicit", () => {
  const bounded = calculateBlastRadius({
    treasuryAvailableBaseUnits: 100_000_000n,
    perTransactionRemainingBaseUnits: 20_000_000n,
    taskRemainingBaseUnits: 20_000_000n,
    dailyRemainingBaseUnits: 20_000_000n,
    lifetimeRemainingBaseUnits: 20_000_000n,
    onchainRemainingAllowanceBaseUnits: 5_000_000n,
  });
  assert.equal(bounded.effectiveMaximumAuthorizedExposureBaseUnits, 5_000_000n);
  assert.equal(bounded.currentTaskExposureBaseUnits, 5_000_000n);

  const empty = calculateBlastRadius({
    treasuryAvailableBaseUnits: 0n,
    perTransactionRemainingBaseUnits: 0n,
    taskRemainingBaseUnits: 0n,
    dailyRemainingBaseUnits: 0n,
    lifetimeRemainingBaseUnits: 0n,
    onchainRemainingAllowanceBaseUnits: 0n,
  });
  assert.equal(empty.treasuryOutsideAuthorityBps, null);
});

test("rejects negative financial context", () => {
  assert.throws(
    () =>
      calculateBlastRadius({
        treasuryAvailableBaseUnits: -1n,
        perTransactionRemainingBaseUnits: 0n,
        taskRemainingBaseUnits: 0n,
        dailyRemainingBaseUnits: 0n,
        lifetimeRemainingBaseUnits: 0n,
        onchainRemainingAllowanceBaseUnits: 0n,
      }),
    RangeError,
  );
});

test("compares unrestricted treasury authority with policy-constrained authority", () => {
  const comparison = compareBlastRadius(10_000_000_000n, {
    treasuryAvailableBaseUnits: 10_000_000_000n,
    perTransactionRemainingBaseUnits: 2_000_000n,
    taskRemainingBaseUnits: 3_000_000n,
    dailyRemainingBaseUnits: 20_000_000n,
    lifetimeRemainingBaseUnits: 200_000_000n,
    onchainRemainingAllowanceBaseUnits: 20_000_000n,
  });
  assert.equal(comparison.unrestrictedExposureBaseUnits, 10_000_000_000n);
  assert.equal(comparison.policyConstrained.currentTaskExposureBaseUnits, 3_000_000n);
  assert.equal(comparison.policyConstrained.effectiveMaximumAuthorizedExposureBaseUnits, 20_000_000n);
  assert.equal(comparison.reductionBps, 9_980);
});
