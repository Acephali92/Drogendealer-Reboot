import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InventoryItem, MarketEntry, Player, TradeSide } from '@/api/types';
import { useTrade } from '@/api/queries';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { Tabs } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CommodityIcon } from '@/components/ui/CommodityIcon';
import { formatNumber, formatWeight, multiplyMoney, toCents } from '@/lib/money';
import { errorMessage } from '@/lib/errors';
import { toast } from '@/stores/toast';
import { tradeLimit } from './limits';

interface Props {
  entry: MarketEntry | null;
  initialSide: TradeSide;
  player: Player;
  owned: InventoryItem | undefined;
  cityId: string;
  cargo: { used: number; capacity: number | null; free: number | null };
  onClose: () => void;
}

export function TradeDialog({ entry, initialSide, player, owned, cityId, cargo, onClose }: Props) {
  const { t } = useTranslation();
  const trade = useTrade();
  const [side, setSide] = useState<TradeSide>(initialSide);
  const [qty, setQty] = useState(0);

  useEffect(() => {
    setSide(initialSide);
    setQty(0);
  }, [entry?.commodity.id, initialSide]);

  if (!entry) return null;
  const c = entry.commodity;
  const unit = side === 'BUY' ? entry.buyPrice : entry.sellPrice;
  const ownedQty = owned?.quantity ?? 0;
  const { max, reason } = tradeLimit(side, {
    cash: player.cash,
    unitPrice: unit,
    supply: entry.supply,
    owned: ownedQty,
    freeG: cargo.free,
    unitWeightG: c.unitWeightG,
  });
  const q = Math.min(qty, max);
  const total = multiplyMoney(unit, q);
  const weight = q * c.unitWeightG;
  const usedAfter = side === 'BUY' ? cargo.used + weight : cargo.used - weight;
  const profit = side === 'SELL' && owned ? (toCents(entry.sellPrice) - toCents(owned.avgBuyPrice)) * BigInt(q) : null;

  const submit = () =>
    trade.mutate(
      { cityId, commodityId: c.id, side, quantity: q },
      {
        onSuccess: () => {
          toast.success(t(side === 'BUY' ? 'trade.bought' : 'trade.sold', { qty: formatNumber(q), name: c.name }));
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Modal open={!!entry} onClose={onClose} title={c.name}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <CommodityIcon slug={c.slug} size={52} />
          <div className="min-w-0 flex-1">
            <Tabs
              value={side}
              onChange={(v) => {
                setSide(v);
                setQty(0);
              }}
              items={[
                { value: 'BUY', label: t('trade.buy') },
                { value: 'SELL', label: t('trade.sell'), count: ownedQty },
              ]}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-bg/60 p-3 text-sm ring-1 ring-line/10">
          <div>
            <dt className="label">{side === 'BUY' ? t('trade.buyPrice') : t('trade.sellPrice')}</dt>
            <dd>
              <Money value={unit} className="text-lg font-semibold text-ink" />
              <span className="ml-1 text-xs text-ink-faint">{t('trade.perUnit', { unit: formatWeight(c.unitWeightG) })}</span>
            </dd>
          </div>
          <div>
            <dt className="label">{side === 'BUY' ? t('trade.available') : t('trade.owned')}</dt>
            <dd className="num text-lg font-semibold text-ink">{formatNumber(side === 'BUY' ? entry.supply : ownedQty)}</dd>
          </div>
        </dl>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label">{t('trade.quantity')}</span>
            <span className="text-xs text-ink-faint">
              {t('trade.max')}: <span className="num">{formatNumber(max)}</span> ·{' '}
              {t('trade.limits', { reason: t(`trade.${reason}`) })}
            </span>
          </div>
          <NumberStepper value={q} onChange={setQty} max={max} label={t('trade.quantity')} />
        </div>

        <div className="space-y-2 rounded-xl bg-surface-2 p-4 ring-1 ring-line/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">{t('trade.total')}</span>
            <Money value={total} className={side === 'BUY' ? 'text-xl font-bold text-ink' : 'text-xl font-bold text-neon'} />
          </div>
          {profit !== null && q > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-muted">{t('trade.profit')}</span>
              <Money value={profit} signed colored className="font-semibold" />
            </div>
          )}
          <div className="pt-1">
            <div className="mb-1 flex justify-between text-xs text-ink-faint">
              <span>{t('stats.cargo')}</span>
              <span className="num">
                {formatWeight(usedAfter)}
                {cargo.capacity !== null ? ` / ${formatWeight(cargo.capacity)}` : ` · ${t('stats.noVehicle')}`}
              </span>
            </div>
            {cargo.capacity !== null && <ProgressBar value={usedAfter / Math.max(1, cargo.capacity)} tone="auto" />}
          </div>
        </div>

        <Button
          variant={side === 'BUY' ? 'primary' : 'neon'}
          size="lg"
          className="w-full"
          disabled={q <= 0}
          loading={trade.isPending}
          onClick={submit}
        >
          {t(side === 'BUY' ? 'trade.confirmBuy' : 'trade.confirmSell', { qty: formatNumber(q) })}
        </Button>
      </div>
    </Modal>
  );
}
