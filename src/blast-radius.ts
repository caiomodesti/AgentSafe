import { assertNonNegativeBaseUnits } from "./money.js";

export interface BlastRadiusInput {
  readonly treasuryAvailableBaseUnits: bigint;
  readonly perTransactionRemainingBaseUnits: bigint;
  readonly taskRemainingBaseUnits: bigint;
  readonly dailyRemainingBaseUnits: bigint;
  readonly lifetimeRemainingBaseUnits: bigint;
  readonly onchainRemainingAllowanceBaseUnits: bigint;
}

export interface BlastRadius {
  readonly perTransactionExposureBaseUnits: bigint;
  readonly currentTaskExposureBaseUnits: bigint;
  readonly effectiveMaximumAuthorizedExposureBaseUnits: bigint;
  /** Integer basis points; 9_980 means 99.80%. Null when treasury is zero. */
  readonly treasuryOutsideAuthorityBps: number | null;
}

export interface BlastRadiusComparison {
  readonly unrestrictedExposureBaseUnits: bigint;
  readonly policyConstrained: BlastRadius;
  /** Integer basis points; null when there is no initial authority. */
  readonly reductionBps: number | null;
}

function minimum(values: readonly bigint[]): bigint {
  return values.reduce((lowest, value) => (value < lowest ? value : lowest));
}

export function calculateBlastRadius(input: BlastRadiusInput): BlastRadius {
  for (const [field, value] of Object.entries(input)) {
    assertNonNegativeBaseUnits(value, field);
  }

  const effectiveMaximumAuthorizedExposureBaseUnits = minimum([
    input.dailyRemainingBaseUnits,
    input.lifetimeRemainingBaseUnits,
    input.onchainRemainingAllowanceBaseUnits,
  ]);
  const currentTaskExposureBaseUnits = minimum([
    input.taskRemainingBaseUnits,
    effectiveMaximumAuthorizedExposureBaseUnits,
  ]);
  const perTransactionExposureBaseUnits = minimum([
    input.perTransactionRemainingBaseUnits,
    currentTaskExposureBaseUnits,
  ]);

  const authorizedAgainstTreasury = minimum([
    effectiveMaximumAuthorizedExposureBaseUnits,
    input.treasuryAvailableBaseUnits,
  ]);
  const treasuryOutsideAuthorityBps =
    input.treasuryAvailableBaseUnits === 0n
      ? null
      : Number(
          ((input.treasuryAvailableBaseUnits - authorizedAgainstTreasury) * 10_000n) /
            input.treasuryAvailableBaseUnits,
        );

  return {
    perTransactionExposureBaseUnits,
    currentTaskExposureBaseUnits,
    effectiveMaximumAuthorizedExposureBaseUnits,
    treasuryOutsideAuthorityBps,
  };
}

/**
 * Compares the treasury authority available before controls with the authority
 * remaining under a concrete policy. It describes financial authority, not a
 * guarantee that every possible loss is prevented.
 */
export function compareBlastRadius(
  treasuryAvailableBaseUnits: bigint,
  constrainedInput: BlastRadiusInput,
): BlastRadiusComparison {
  assertNonNegativeBaseUnits(treasuryAvailableBaseUnits, "treasuryAvailableBaseUnits");
  const policyConstrained = calculateBlastRadius(constrainedInput);
  const unrestrictedExposureBaseUnits = treasuryAvailableBaseUnits;
  const reductionBps =
    unrestrictedExposureBaseUnits === 0n
      ? null
      : Number(
          ((unrestrictedExposureBaseUnits - policyConstrained.effectiveMaximumAuthorizedExposureBaseUnits) *
            10_000n) /
            unrestrictedExposureBaseUnits,
        );
  return { unrestrictedExposureBaseUnits, policyConstrained, reductionBps };
}
