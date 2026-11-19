import type { Money, TradeSide } from '@/api/types';
import { affordable } from '@/lib/money';

export type LimitReason = 'limitCash' | 'limitCargo' | 'limitSupply' | 'limitOwned';

/**
 * Maximal handelbare Menge und der begrenzende Faktor. Bis T-103 echte Orderpreise liefert,
 * dient der Richtpreis als Stückpreis; der Server prüft verbindlich.
 */
export function tradeLimit(
  side: TradeSide,
  o: { cash: Money; unitPrice: Money; supply: number; owned: number; free: number; unitVolume: number },
): { max: number; reason: LimitReason } {
  if (side === 'SELL') return { max: Math.max(0, o.owned), reason: 'limitOwned' };
  const candidates: [number, LimitReason][] = [
    [affordable(o.cash, o.unitPrice), 'limitCash'],
    [Math.floor(Math.max(0, o.supply)), 'limitSupply'],
    [Math.floor(Math.max(0, o.free) / Math.max(1e-9, o.unitVolume)), 'limitCargo'],
  ];
  candidates.sort((a, b) => a[0] - b[0]);
  const [max, reason] = candidates[0]!;
  return { max, reason };
}
