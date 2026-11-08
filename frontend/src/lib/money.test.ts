import { affordable, formatMoney, formatWeight, multiplyMoney, percentDelta, toCents } from './money';

describe('money', () => {
  it('parst Cent-Strings als BigInt', () => {
    expect(toCents('3000000')).toBe(3000000n);
    expect(toCents('9007199254740993123')).toBe(9007199254740993123n);
    expect(toCents('kaputt')).toBe(0n);
  });

  it('formatiert deutsch mit Euro', () => {
    expect(formatMoney('3000000')).toBe('30.000 €');
    expect(formatMoney('12345')).toBe('123,45 €');
    expect(formatMoney('-500', { cents: true })).toBe('−5,00 €');
    expect(formatMoney('500', { signed: true })).toBe('+5 €');
  });

  it('rechnet Mengen und Budget ohne Fließkomma', () => {
    expect(multiplyMoney('3500', 3)).toBe(10500n);
    expect(affordable('3000000', '3500')).toBe(857);
    expect(affordable('100', '0')).toBe(0);
  });

  it('berechnet prozentuale Abweichung', () => {
    expect(percentDelta('150', '100')).toBe(50);
    expect(percentDelta('90', '100')).toBe(-10);
    expect(percentDelta('90', '0')).toBeNull();
  });

  it('formatiert Gewicht', () => {
    expect(formatWeight(750)).toBe('750 g');
    expect(formatWeight(242_500)).toBe('242,5 kg');
  });
});
