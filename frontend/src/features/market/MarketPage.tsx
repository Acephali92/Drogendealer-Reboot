import { useMemo, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOverview } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Money } from '@/components/ui/Money';
import { CommodityIcon } from '@/components/ui/CommodityIcon';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { percentDelta, toCents } from '@/lib/money';
import { cn } from '@/lib/cn';
import { TrendIcon } from '@/features/trade/TradePage';

export function MarketPage() {
  const { t } = useTranslation();
  const { city } = useGame();
  const ov = useOverview();
  const [mode, setMode] = useState<'buyPrice' | 'sellPrice'>('buyPrice');

  const stats = useMemo(() => {
    const d = ov.data;
    if (!d) return [];
    return d.commodities.map((c) => {
      let minBuy: { city: string; v: bigint } | null = null;
      let maxSell: { city: string; v: bigint } | null = null;
      for (const ci of d.cities) {
        const p = d.prices[ci.id]?.[c.id];
        if (!p) continue;
        const b = toCents(p.buyPrice);
        const s = toCents(p.sellPrice);
        if (!minBuy || b < minBuy.v) minBuy = { city: ci.id, v: b };
        if (!maxSell || s > maxSell.v) maxSell = { city: ci.id, v: s };
      }
      const pct = minBuy && maxSell ? percentDelta(maxSell.v, minBuy.v) : null;
      return { c, minBuy, maxSell, pct };
    });
  }, [ov.data]);

  const name = (id?: string) => ov.data?.cities.find((c) => c.id === id)?.name ?? '—';

  return (
    <div>
      <PageHeader
        title={t('market.title')}
        subtitle={t('market.subtitle')}
        actions={
          <Tabs
            value={mode}
            onChange={setMode}
            items={[
              { value: 'buyPrice', label: t('market.showBuy') },
              { value: 'sellPrice', label: t('market.showSell') },
            ]}
          />
        }
      />
      {ov.isError && <ErrorState error={ov.error} onRetry={() => ov.refetch()} />}
      {ov.isPending && <Skeleton className="h-96" />}

      {ov.data && (
        <>
          {/* Routen-Karten */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats
              .filter((s) => s.pct !== null && s.pct > 0)
              .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
              .slice(0, 3)
              .map((s) => (
                <div key={s.c.id} className="panel flex items-center gap-3 p-4">
                  <CommodityIcon slug={s.c.slug} size={40} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-ink">{s.c.name}</p>
                    <p className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                      <span className="text-neon">{name(s.minBuy?.city)}</span>
                      <ArrowRight className="h-3 w-3" aria-hidden />
                      <span className="text-brass">{name(s.maxSell?.city)}</span>
                    </p>
                  </div>
                  <span className="num text-lg font-bold text-neon">+{s.pct?.toLocaleString('de-DE')} %</span>
                </div>
              ))}
          </div>

          {/* Matrix */}
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line/10">
                    <th className="label sticky left-0 z-10 bg-surface px-4 py-3 text-left">{t('market.commodity')}</th>
                    {ov.data.cities.map((c) => (
                      <th
                        key={c.id}
                        className={cn(
                          'label whitespace-nowrap px-3 py-3 text-right',
                          c.id === city?.id && 'bg-brass/10 text-brass',
                        )}
                      >
                        {c.id === city?.id && <MapPin className="mr-1 inline h-3 w-3" aria-label={t('market.here')} />}
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/5">
                  {stats.map(({ c, minBuy, maxSell }) => (
                    <tr key={c.id} className="hover:bg-surface-2/50">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left">
                        <span className="flex items-center gap-2 font-semibold text-ink">
                          <CommodityIcon slug={c.slug} size={28} />
                          {c.name}
                        </span>
                      </th>
                      {ov.data!.cities.map((ci) => {
                        const p = ov.data!.prices[ci.id]?.[c.id];
                        if (!p) return <td key={ci.id} />;
                        const best =
                          mode === 'buyPrice' ? minBuy?.city === ci.id : maxSell?.city === ci.id;
                        return (
                          <td
                            key={ci.id}
                            className={cn(
                              'whitespace-nowrap px-3 py-2.5 text-right',
                              ci.id === city?.id && 'bg-brass/5',
                            )}
                          >
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
                                best && mode === 'buyPrice' && 'bg-neon/10 font-semibold text-neon ring-1 ring-neon/30',
                                best && mode === 'sellPrice' && 'bg-brass/10 font-semibold text-brass ring-1 ring-brass/30',
                                !best && 'text-ink-muted',
                              )}
                            >
                              <Money value={p[mode]} />
                              <TrendIcon trend={p.trend} className="h-3 w-3" />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
