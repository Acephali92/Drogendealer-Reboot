import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Info, Megaphone, Minus, ShoppingCart, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MarketEntry, TradeSide, Trend } from '@/api/types';
import { useMarket, useOverview } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { CommodityImage } from '@/components/ui/GameImages';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatNumber, formatVolume, multiplyMoney, percentDelta, toCents } from '@/lib/money';
import { eventLabel } from '@/lib/events';
import { cn } from '@/lib/cn';
import { TravelProgress } from '@/features/city/TravelProgress';
import { TradeDialog } from './TradeDialog';

export function TrendIcon({ trend, className }: { trend: Trend; className?: string }) {
  if (trend === 'UP')
    return <ArrowUpRight className={cn('h-4 w-4 text-danger', className)} aria-label="steigt" />;
  if (trend === 'DOWN')
    return <ArrowDownRight className={cn('h-4 w-4 text-neon', className)} aria-label="fällt" />;
  return <Minus className={cn('h-4 w-4 text-ink-faint', className)} aria-label="stabil" />;
}

/** Aktives Marktereignis (Razzia, Lieferung, Stadtfest) mit Anzeigenamen aus parameters.toml. */
export function EventBadge({ entry }: { entry: Pick<MarketEntry, 'activeEvent' | 'eventTicksLeft'> }) {
  const { t } = useTranslation();
  const label = eventLabel(entry.activeEvent);
  if (!label) return null;
  return (
    <Badge tone="warn" className="normal-case tracking-normal">
      <Megaphone className="h-3 w-3" aria-hidden />
      {label}
      {entry.eventTicksLeft !== null && (
        <span className="font-normal opacity-80">
          · {t('market.eventTicks', { n: entry.eventTicksLeft })}
        </span>
      )}
    </Badge>
  );
}

type Filter = 'all' | 'owned';
type Sort = 'name' | 'price' | 'deal';

export function TradePage() {
  const { t } = useTranslation();
  const { player, city, traveling, travel, destination, cityById, inventory, cargo } = useGame();
  const market = useMarket(city?.slug);
  const overview = useOverview();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');
  const [dialog, setDialog] = useState<{ slug: string; side: TradeSide } | null>(() => {
    const w = params.get('ware');
    return w ? { slug: w, side: 'BUY' } : null;
  });

  /** Höchster Richtpreis in ganz Europa je Ware (aus /market/overview). */
  const best = useMemo(() => new Map((overview.data ?? []).map((r) => [r.commodity.id, r])), [overview.data]);

  const ownedBy = useMemo(
    () => new Map((inventory.data?.items ?? []).map((i) => [i.commodity.id, i])),
    [inventory.data],
  );

  const rows = useMemo(() => {
    let list = [...(market.data ?? [])];
    if (filter === 'owned') list = list.filter((m) => (ownedBy.get(m.commodity.id)?.quantity ?? 0) > 0);
    const deal = (m: MarketEntry) => percentDelta(m.referencePrice, m.commodity.basePrice) ?? 0;
    if (sort === 'name') list.sort((a, b) => a.commodity.name.localeCompare(b.commodity.name, 'de'));
    if (sort === 'price') list.sort((a, b) => Number(toCents(b.referencePrice) - toCents(a.referencePrice)));
    if (sort === 'deal') list.sort((a, b) => deal(a) - deal(b));
    return list;
  }, [market.data, filter, sort, ownedBy]);

  if (traveling && travel) {
    return <TravelProgress travel={travel} from={cityById(travel.fromCityId)} to={destination} />;
  }
  if (!player || !city) return null;

  const openEntry = dialog ? (market.data?.find((m) => m.commodity.slug === dialog.slug) ?? null) : null;
  const close = () => {
    setDialog(null);
    if (params.has('ware')) setParams({}, { replace: true });
  };

  return (
    <div>
      <PageHeader title={t('trade.title', { city: city.name })} subtitle={t('trade.subtitle')} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: t('trade.filterAll') },
            { value: 'owned', label: t('trade.filterOwned'), count: inventory.data?.items.length },
          ]}
        />
        <Tabs
          value={sort}
          onChange={setSort}
          label={t('trade.sortBy')}
          items={[
            { value: 'name', label: t('trade.sortName') },
            { value: 'price', label: t('trade.sortPrice') },
            { value: 'deal', label: t('trade.sortDeal') },
          ]}
        />
      </div>

      <p className="mb-5 flex items-start gap-2 text-xs text-ink-faint">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('trade.priceNote')}
      </p>

      {market.isError && <ErrorState error={market.error} onRetry={() => market.refetch()} />}
      <div className="grid gap-4 xl:grid-cols-2">
        {market.isPending && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56" />)}
        {rows.map((m, i) => {
          const own = ownedBy.get(m.commodity.id);
          const ownedQty = own?.quantity ?? 0;
          const top = best.get(m.commodity.id)?.highestPrice;
          const vsBase = percentDelta(m.referencePrice, m.commodity.basePrice);
          return (
            <article
              key={m.commodity.id}
              className="panel animate-fade-up overflow-hidden"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <header className="panel-header">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate font-display font-semibold text-ink">{m.commodity.name}</h2>
                  <EventBadge entry={m} />
                </div>
                <TrendIcon trend={m.trend} />
              </header>
              <div className="p-4">
                {top && top.city.id !== city.id && (
                  <p className="mb-4 text-xs text-ink-faint">
                    {t('trade.bestSellHint')} <Money value={top.referencePrice} className="text-brass" />{' '}
                    {t('trade.in')} <span className="text-brass">{top.city.name}</span>
                  </p>
                )}
                <div className="flex gap-4">
                  <span className="hidden shrink-0 sm:block">
                    <CommodityImage commodity={m.commodity} size={64} />
                  </span>
                  <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <dl className="space-y-1.5 text-sm">
                      <p className="mb-1 font-semibold text-ink">{city.name}</p>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{t('trade.referencePrice')}</dt>
                        <dd>
                          <Money value={m.referencePrice} className="font-semibold text-ink" />
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{t('trade.stock')}</dt>
                        <dd className="num text-ink">{formatNumber(m.stock)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{t('trade.volume')}</dt>
                        <dd className="num text-ink">
                          {t('trade.perUnitVolume', { v: formatVolume(m.commodity.unitVolume) })}
                        </dd>
                      </div>
                      {vsBase !== null && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">{t('trade.vsBase')}</dt>
                          <dd
                            className={cn(
                              'num font-semibold',
                              vsBase < 0 ? 'text-neon' : vsBase > 0 ? 'text-danger' : 'text-ink-muted',
                            )}
                          >
                            {vsBase > 0 ? '+' : ''}
                            {vsBase.toLocaleString('de-DE')} %
                          </dd>
                        </div>
                      )}
                    </dl>
                    <dl className="space-y-1.5 border-line/10 text-sm sm:border-l sm:pl-6">
                      <p className="mb-1 font-semibold text-brass">{player.name}</p>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{t('trade.owned')}</dt>
                        <dd className="num text-ink">
                          {formatNumber(ownedQty)}{' '}
                          <span className="text-ink-faint">
                            ({formatVolume(ownedQty * m.commodity.unitVolume)})
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{t('trade.avgPrice')}</dt>
                        <dd>
                          <Money value={own?.avgBuyPrice ?? '0'} className="text-ink" />
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">{t('trade.value')}</dt>
                        <dd>
                          <Money
                            value={multiplyMoney(m.referencePrice, ownedQty)}
                            className="font-semibold text-neon"
                          />
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => setDialog({ slug: m.commodity.slug, side: 'BUY' })}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {t('trade.buy')}
                  </Button>
                  <Button
                    variant="neon"
                    className="flex-1"
                    disabled={ownedQty === 0}
                    onClick={() => setDialog({ slug: m.commodity.slug, side: 'SELL' })}
                  >
                    <Tag className="h-4 w-4" />
                    {t('trade.sell')}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {cargo && (
        <TradeDialog
          entry={openEntry}
          initialSide={dialog?.side ?? 'BUY'}
          player={player}
          owned={openEntry ? ownedBy.get(openEntry.commodity.id) : undefined}
          cityId={city.id}
          cargo={cargo}
          onClose={close}
        />
      )}
    </div>
  );
}
