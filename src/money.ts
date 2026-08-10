const DECIMAL_INTEGER = /^(0|[1-9]\d*)$/;

export function parseBaseUnits(value: string): bigint {
  if (!DECIMAL_INTEGER.test(value)) {
    throw new TypeError("base units must be a non-negative decimal integer string");
  }
  return BigInt(value);
}

export function assertPositiveBaseUnits(value: bigint, field = "amountBaseUnits"): void {
  if (value <= 0n) throw new RangeError(`${field} must be greater than zero`);
}

export function assertNonNegativeBaseUnits(value: bigint, field: string): void {
  if (value < 0n) throw new RangeError(`${field} must not be negative`);
}

export function remaining(limit: bigint, spent: bigint, reserved: bigint): bigint {
  const value = limit - spent - reserved;
  return value > 0n ? value : 0n;
}

export function wouldExceed(limit: bigint, spent: bigint, reserved: bigint, requested: bigint): boolean {
  return spent + reserved + requested > limit;
}

