import type { Money } from '@/api/types';

const intFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Wandelt einen Cent-String sicher in BigInt um. Ungültige Werte ergeben 0n. */
export function toCents(value: Money | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  try {
    return BigInt(value.trim() || '0');
  } catch {
    return 0n;
  }
}

export interface FormatMoneyOptions {
  /** Cent immer anzeigen (Standard: nur wenn ≠ 0). */
  cents?: boolean | 'auto';
  /** Vorzeichen auch bei positiven Beträgen (z. B. Buchungen). */
  signed?: boolean;
  /** Währungszeichen anhängen. */
  currency?: boolean;
}

/** 3000000 → „30.000 €“, 12345 → „123,45 €“. Rechnet ausschließlich mit BigInt. */
export function formatMoney(value: Money | number | bigint, opts: FormatMoneyOptions = {}): string {
  const { cents = 'auto', signed = false, currency = true } = opts;
  const v = toCents(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const euros = abs / 100n;
  const rest = abs % 100n;
  let out = intFmt.format(euros);
  if (cents === true || (cents === 'auto' && rest !== 0n)) {
    out += ',' + rest.toString().padStart(2, '0');
  }
  const sign = negative ? '−' : signed && v > 0n ? '+' : '';
  return `${sign}${out}${currency ? ' €' : ''}`;
}

/** Kompakte Darstellung für Kacheln: 1,2 Mio. €. */
export function formatMoneyCompact(value: Money | bigint): string {
  const v = toCents(value);
  const euros = Number(v / 100n);
  return (
    new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(euros) + ' €'
  );
}

export function multiplyMoney(unit: Money | bigint, quantity: number): bigint {
  return toCents(unit) * BigInt(Math.max(0, Math.trunc(quantity)));
}

/** Wie viele Einheiten sind mit diesem Budget bezahlbar? */
export function affordable(budget: Money | bigint, unitPrice: Money | bigint): number {
  const p = toCents(unitPrice);
  if (p <= 0n) return 0;
  const n = toCents(budget) / p;
  return n > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(n);
}

/** Prozentuale Abweichung (z. B. Gewinn ggü. Einkaufspreis), auf 1 Nachkommastelle. */
export function percentDelta(current: Money | bigint, reference: Money | bigint): number | null {
  const ref = toCents(reference);
  if (ref === 0n) return null;
  const diff = (toCents(current) - ref) * 1000n;
  return Number(diff / ref) / 10;
}

const numFmt = new Intl.NumberFormat('de-DE');
export const formatNumber = (n: number) => numFmt.format(n);

/** Gramm → „750 g“ bzw. „242,5 kg“ bzw. „1,2 t“. */
export function formatWeight(grams: number): string {
  const g = Math.max(0, Math.round(grams));
  if (g < 1000) return `${numFmt.format(g)} g`;
  if (g < 1_000_000) {
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(g / 1000)} kg`;
  }
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(g / 1_000_000)} t`;
}
