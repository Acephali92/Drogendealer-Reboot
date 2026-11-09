/**
 * Money arithmetic for game rules. All amounts are integer cents as BigInt (ADR-019):
 * 100n = 1,00 €. Conversion to euros happens only for display (frontend).
 *
 * Rounding rule (exploit catalogue, Agent 6): amounts paid TO a player are rounded DOWN,
 * amounts charged TO a player are rounded UP. Splitting an order into many small ones can
 * therefore never create money out of rounding.
 */

export type Rounding = 'floor' | 'ceil';

/** Fixed-point scale for fractional factors (prices × elasticity, fees, rates): 9 decimals. */
export const FACTOR_SCALE = 1_000_000_000n;

function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b; // truncates toward zero
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n === b < 0n ? q + 1n : q;
}

/** value × numerator / denominator with explicit rounding direction (exact, no float). */
export function mulDiv(value: bigint, numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  if (denominator <= 0n) throw new RangeError('mulDiv: denominator must be positive');
  const product = value * numerator;
  return rounding === 'floor' ? floorDiv(product, denominator) : ceilDiv(product, denominator);
}

/** Converts a decimal factor (e.g. 1.05 or 0.15) into a fixed-point integer with 9 decimals. */
export function toFixedFactor(factor: number): bigint {
  if (!Number.isFinite(factor)) throw new RangeError(`toFixedFactor: factor ${factor} is not finite`);
  const scaled = Math.round(factor * Number(FACTOR_SCALE));
  if (!Number.isSafeInteger(scaled)) throw new RangeError(`toFixedFactor: factor ${factor} out of range`);
  return BigInt(scaled);
}

/** value × factor, rounded in the given direction. */
export function applyFactor(value: bigint, factor: number, rounding: Rounding): bigint {
  return mulDiv(value, toFixedFactor(factor), FACTOR_SCALE, rounding);
}

/** Amount credited to a player (income, sale proceeds, loot): rounded down. */
export function creditAmount(value: bigint, factor = 1): bigint {
  return applyFactor(value, factor, 'floor');
}

/** Amount debited from a player (purchase price, fee, cost): rounded up. */
export function debitAmount(value: bigint, factor = 1): bigint {
  return applyFactor(value, factor, 'ceil');
}

/** Unit price × quantity. Quantity must be a non-negative safe integer. */
export function total(unitPrice: bigint, quantity: number): bigint {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`total: quantity ${quantity} must be a non-negative integer`);
  }
  return unitPrice * BigInt(quantity);
}

/** Parses a money string from the API in cents ("150000", "-20"); rejects decimals and garbage. */
export function parseMoney(input: string): bigint {
  if (!/^-?\d{1,30}$/.test(input))
    throw new RangeError(`parseMoney: "${input}" is not an integer amount of cents`);
  return BigInt(input);
}

export const minMoney = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const maxMoney = (a: bigint, b: bigint): bigint => (a > b ? a : b);
