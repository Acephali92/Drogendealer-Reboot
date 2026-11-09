import { describe, expect, it } from 'vitest';
import {
  applyFactor,
  creditAmount,
  debitAmount,
  mulDiv,
  parseMoney,
  toFixedFactor,
  total,
} from '../../src/domain/index.js';

describe('mulDiv', () => {
  it.each([
    // value, num, den, floor, ceil
    [10n, 1n, 3n, 3n, 4n],
    [9n, 1n, 3n, 3n, 3n],
    [-10n, 1n, 3n, -4n, -3n],
    [0n, 5n, 7n, 0n, 0n],
    [10n, -1n, 3n, -4n, -3n],
  ])('%s × %s / %s → floor %s, ceil %s', (v, n, d, floor, ceil) => {
    expect(mulDiv(v, n, d, 'floor')).toBe(floor);
    expect(mulDiv(v, n, d, 'ceil')).toBe(ceil);
  });

  it('rejects non-positive denominators', () => {
    expect(() => mulDiv(1n, 1n, 0n, 'floor')).toThrow(RangeError);
    expect(() => mulDiv(1n, 1n, -2n, 'floor')).toThrow(RangeError);
  });

  it('stays exact far beyond Number precision', () => {
    const big = 123_456_789_012_345_678_901n;
    expect(mulDiv(big, 3n, 3n, 'floor')).toBe(big);
  });
});

describe('credit / debit rounding (exploit protection)', () => {
  it('rounds credits down and debits up', () => {
    expect(creditAmount(101n, 0.5)).toBe(50n);
    expect(debitAmount(101n, 0.5)).toBe(51n);
    expect(creditAmount(100n)).toBe(100n);
    expect(debitAmount(100n)).toBe(100n);
  });

  it('never creates money by splitting a sale into small parts', () => {
    // Selling 1 unit 100 times with a 15 % fee must not pay more than one sale of 100 units.
    const unit = 7n;
    const feeFactor = 0.85;
    const split = Array.from({ length: 100 }, () => creditAmount(unit, feeFactor)).reduce(
      (a, b) => a + b,
      0n,
    );
    const once = creditAmount(total(unit, 100), feeFactor);
    expect(split).toBeLessThanOrEqual(once);
  });

  it('never makes buying cheaper by splitting a purchase', () => {
    const unit = 7n;
    const markup = 1.13;
    const split = Array.from({ length: 100 }, () => debitAmount(unit, markup)).reduce((a, b) => a + b, 0n);
    const once = debitAmount(total(unit, 100), markup);
    expect(split).toBeGreaterThanOrEqual(once);
  });
});

describe('factors and parsing', () => {
  it('converts decimal factors to 9-digit fixed point', () => {
    expect(toFixedFactor(1)).toBe(1_000_000_000n);
    expect(toFixedFactor(0.15)).toBe(150_000_000n);
    expect(toFixedFactor(1.1)).toBe(1_100_000_000n);
    expect(applyFactor(1000n, 0, 'ceil')).toBe(0n);
    expect(() => toFixedFactor(Number.NaN)).toThrow(RangeError);
    expect(() => toFixedFactor(Infinity)).toThrow(RangeError);
    expect(() => toFixedFactor(1e10)).toThrow(RangeError);
  });

  it('computes totals and rejects invalid quantities', () => {
    expect(total(5n, 3)).toBe(15n);
    expect(total(5n, 0)).toBe(0n);
    expect(() => total(5n, -1)).toThrow(RangeError);
    expect(() => total(5n, 1.5)).toThrow(RangeError);
  });

  it('parses whole money strings only', () => {
    expect(parseMoney('1500')).toBe(1500n);
    expect(parseMoney('-20')).toBe(-20n);
    for (const bad of ['1.5', '1e3', '', ' 1', '0x10', 'abc']) {
      expect(() => parseMoney(bad)).toThrow(RangeError);
    }
  });
});
