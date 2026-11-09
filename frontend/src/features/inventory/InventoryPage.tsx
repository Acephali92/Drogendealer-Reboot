import { Link } from 'react-router-dom';
import { Crosshair, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEquipment, useMarket } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { Money } from '@/components/ui/Money';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CommodityImage, EquipmentImage } from '@/components/ui/GameImages';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney, formatNumber, formatWeight, multiplyMoney, percentDelta } from '@/lib/money';
import { cn } from '@/lib/cn';

export function InventoryPage() {
  const { t } = useTranslation();
  const { city, inventory, cargo } = useGame();
  const market = useMarket(city?.slug);
  const equipment = useEquipment();
  const items = inventory.data?.items ?? [];
  const sellPrice = new Map((market.data ?? []).map((m) => [m.commodity.id, m.sellPrice]));

  const cost = items.reduce((s, i) => s + multiplyMoney(i.avgBuyPrice, i.quantity), 0n);
  const value = items.reduce(
    (s, i) => s + multiplyMoney(sellPrice.get(i.commodity.id) ?? i.avgBuyPrice, i.quantity),
    0n,
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('inventory.title')} subtitle={t('inventory.subtitle')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('stats.cargo')}
          value={cargo ? formatWeight(cargo.used) : '—'}
          hint={
            cargo && (
              <div className="space-y-1">
                {cargo.capacity !== null && (
                  <ProgressBar value={cargo.used / Math.max(1, cargo.capacity)} tone="auto" size="xs" />
                )}
                <span className="num">
                  {t('stats.freeCargo')}:{' '}
                  {cargo.free !== null ? formatWeight(cargo.free) : t('stats.noVehicle')}
                </span>
              </div>
            )
          }
        />
        <StatTile label={t('inventory.costBasis')} value={formatMoney(cost)} />
        <StatTile label={t('inventory.estimate')} value={formatMoney(value)} tone="neon" />
        <StatTile
          label={t('inventory.unrealized')}
          value={formatMoney(value - cost, { signed: true })}
          tone={value - cost >= 0n ? 'neon' : 'danger'}
        />
      </div>

      <Panel title={t('inventory.goods')} icon={<Package className="h-4 w-4" />} padded={false}>
        {inventory.isPending ? (
          <Skeleton className="m-4 h-32" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={t('inventory.empty')}
            hint={t('inventory.emptyHint')}
            action={
              <Link to="/handel">
                <Button variant="primary" size="sm">
                  {t('dashboard.quickTrade')}
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            {/* Tabelle ab sm, Karten am Handy */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="text-left">
                <tr className="border-b border-line/10">
                  <th className="label px-4 py-3">{t('market.commodity')}</th>
                  <th className="label px-4 py-3 text-right">{t('trade.owned')}</th>
                  <th className="label px-4 py-3 text-right">{t('trade.avgPrice')}</th>
                  <th className="label px-4 py-3 text-right">{t('trade.sellPrice')}</th>
                  <th className="label px-4 py-3 text-right">{t('trade.value')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {items.map((i) => {
                  const sp = sellPrice.get(i.commodity.id);
                  const d = sp ? percentDelta(sp, i.avgBuyPrice) : null;
                  return (
                    <tr key={i.commodity.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CommodityImage commodity={i.commodity} size={36} />
                          <div>
                            <p className="font-semibold text-ink">{i.commodity.name}</p>
                            <p className="text-xs text-ink-faint">
                              {formatWeight(i.quantity * i.commodity.unitWeightG)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="num px-4 py-3 text-right text-ink">{formatNumber(i.quantity)}</td>
                      <td className="px-4 py-3 text-right">
                        <Money value={i.avgBuyPrice} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sp ? <Money value={sp} /> : '—'}
                        {d !== null && (
                          <span className={cn('num ml-2 text-xs', d >= 0 ? 'text-neon' : 'text-danger')}>
                            {d > 0 ? '+' : ''}
                            {d.toLocaleString('de-DE')} %
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Money
                          value={multiplyMoney(sp ?? i.avgBuyPrice, i.quantity)}
                          className="font-semibold text-neon"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/handel?ware=${i.commodity.slug}`}>
                          <Button size="sm" variant="neon">
                            {t('trade.sell')}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="divide-y divide-line/5 sm:hidden">
              {items.map((i) => {
                const sp = sellPrice.get(i.commodity.id);
                return (
                  <li key={i.commodity.id}>
                    <Link to={`/handel?ware=${i.commodity.slug}`} className="flex items-center gap-3 p-4">
                      <CommodityImage commodity={i.commodity} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{i.commodity.name}</p>
                        <p className="num text-xs text-ink-muted">
                          {formatNumber(i.quantity)} · Ø {formatMoney(i.avgBuyPrice)}
                        </p>
                      </div>
                      <Money
                        value={multiplyMoney(sp ?? i.avgBuyPrice, i.quantity)}
                        className="font-semibold text-neon"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <Panel title={t('inventory.equipment')} icon={<Crosshair className="h-4 w-4" />}>
        {equipment.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.data.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 ring-1 ring-line/10"
              >
                <EquipmentImage type={e.equipmentType} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{e.equipmentType.name}</p>
                  <p className="num text-xs text-ink-muted">
                    {e.equipmentType.slot === 'WEAPON'
                      ? `${t('weapons.firepower')} ${e.equipmentType.attack}`
                      : `${t('weapons.defense')} ${e.equipmentType.defense}`}{' '}
                    · {formatWeight(e.equipmentType.weightG)}
                  </p>
                </div>
                <Badge tone={e.equipped ? 'brass' : 'neutral'}>
                  {e.equipped ? t('inventory.equipped') : t('inventory.inStock')}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="—"
            action={
              <Link to="/waffen">
                <Button size="sm">{t('city.toWeapons')}</Button>
              </Link>
            }
          />
        )}
      </Panel>
    </div>
  );
}
