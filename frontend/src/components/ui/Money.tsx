import type { Money as MoneyT } from '@/api/types';
import { formatMoney, toCents } from '@/lib/money';
import { cn } from '@/lib/cn';

interface MoneyProps {
  value: MoneyT | bigint;
  signed?: boolean;
  /** Positiv grün, negativ rot */
  colored?: boolean;
  cents?: boolean | 'auto';
  className?: string;
}

export function Money({ value, signed, colored, cents, className }: MoneyProps) {
  const v = toCents(value);
  return (
    <span
      className={cn(
        'num',
        colored && v > 0n && 'text-neon',
        colored && v < 0n && 'text-danger',
        className,
      )}
    >
      {formatMoney(v, { signed, cents })}
    </span>
  );
}
