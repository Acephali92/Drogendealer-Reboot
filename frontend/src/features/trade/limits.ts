import type { Money, TradeSide } from '@/api/types';
import { affordable } from '@/lib/money';

export type LimitReason = 'limitCash' | 'limitCargo' | 'limitSupply' | 'limitOwned';

/** Maximal handelbare Menge und der begrenzende Faktor. */
export function tradeLimit(
  side: TradeSide,
  o: { cash: Money; unitPrice: Money; supply: number; owned: number; freeG: number; unitWeightG: number },
): { max: number; reason: LimitReason } {
  if (side === 'SELL') return { max: Math.max(0, o.owned), reason: 'limitOwned' };
  const candidates: [number, LimitReason][] = [
    [affordable(o.cash, o.unitPrice), 'limitCash'],
    [Math.floor(Math.max(0, o.freeG) / Math.max(1, o.unitWeightG)), 'limitCargo'],
    [Math.max(0, o.supply), 'limitSupply'],
  ];
  candidates.sort((a, b) => a[0] - b[0]);
  const [max, reason] = candidates[0]!;
  return { max, reason };
}
