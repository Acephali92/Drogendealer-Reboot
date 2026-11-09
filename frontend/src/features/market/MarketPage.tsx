import { ArrowRight, MapPin, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useOverview } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Money } from '@/components/ui/Money';
import { CommodityIcon } from '@/components/ui/CommodityIcon';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { percentDelta } from '@/lib/money';
import { formatRelative } from '@/lib/time';
import { cn } from '@/lib/cn';

/** Marktübersicht laut Vertrag: je Ware die günstigste Einkaufs- und die beste Verkaufsstadt. */
export function MarketPage() {
  const { t } = useTranslation();
  const { city } = useGame();
  const ov = useOverview();

  const rows = (ov.data ?? []).map((r) => ({
    ...r,
    margin: r.lowestBuy && r.highestSell ? percentDelta(r.highestSell.price, r.lowestBuy.price) : null,
  }));
  const top = [...rows].filter((r) => (r.margin ?? 0) > 0).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0)).slice(0, 3);

  const CityLink = ({ id, name, tone }: { id: string; name: string; tone: 'neon' | 'brass' }) => (
    <span className={cn('inline-flex items-center gap-1 font-medium', tone === 'neon' ? 'text-neon' : 'text-brass')}>
      {id === city?.id && <MapPin className="h-3 w-3" aria-label={t('market.here')} />}
      {name}
    </span>
  );

  return (
    <div>
      <PageHeader title={t('market.title')} subtitle={t('market.subtitle')} />
      {ov.isError && <ErrorState error={ov.error} onRetry={() => ov.refetch()} />}
      {ov.isPending && <Skeleton className="h-96" />}
      {ov.data?.length === 0 && <EmptyState title={t('market.empty')} />}

      {rows.length > 0 && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {top.map((r) => (
              <div key={r.commodity.id} className="panel flex items-center gap-3 p-4">
                <CommodityIcon slug={r.commodity.slug} size={40} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink">{r.commodity.name}</p>
                  <p className="flex flex-wrap items-center gap-1 text-xs">
                    <CityLink id={r.lowestBuy!.city.id} name={r.lowestBuy!.city.name} tone="neon" />
                    <ArrowRight className="h-3 w-3 text-ink-faint" aria-hidden />
                    <CityLink id={r.highestSell!.city.id} name={r.highestSell!.city.name} tone="brass" />
                  </p>
                </div>
                <span className="num text-lg font-bold text-neon">+{r.margin?.toLocaleString('de-DE')} %</span>
              </div>
            ))}
          </div>

          <div className="panel overflow-hidden">
            {/* Tabelle ab md, Karten am Handy */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line/10 text-left">
                  <th className="label px-4 py-3">{t('market.commodity')}</th>
                  <th className="label px-4 py-3">{t('market.cheapest')}</th>
                  <th className="label px-4 py-3">{t('market.priciest')}</th>
                  <th className="label px-4 py-3 text-right">{t('market.spread')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {rows.map((r) => (
                  <tr key={r.commodity.id} className="hover:bg-surface-2/50">
                    <th scope="row" className="px-4 py-3 text-left">
                      <span className="flex items-center gap-3 font-semibold text-ink">
                        <CommodityIcon slug={r.commodity.slug} size={32} />
                        {r.commodity.name}
                      </span>
                    </th>
                    <td className="px-4 py-3">
                      {r.lowestBuy ? (
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-neon" aria-hidden />
                          <Money value={r.lowestBuy.price} className="font-semibold text-ink" />
                          <CityLink id={r.lowestBuy.city.id} name={r.lowestBuy.city.name} tone="neon" />
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.highestSell ? (
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-brass" aria-hidden />
                          <Money value={r.highestSell.price} className="font-semibold text-ink" />
                          <CityLink id={r.highestSell.city.id} name={r.highestSell.city.name} tone="brass" />
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      className={cn(
                        'num px-4 py-3 text-right font-semibold',
                        (r.margin ?? 0) > 0 ? 'text-neon' : 'text-ink-faint',
                      )}
                    >
                      {r.margin !== null ? `${r.margin > 0 ? '+' : ''}${r.margin.toLocaleString('de-DE')} %` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line/5 md:hidden">
              {rows.map((r) => (
                <li key={r.commodity.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 font-semibold text-ink">
                      <CommodityIcon slug={r.commodity.slug} size={32} />
                      {r.commodity.name}
                    </span>
                    <span className={cn('num font-semibold', (r.margin ?? 0) > 0 ? 'text-neon' : 'text-ink-faint')}>
                      {r.margin !== null ? `${r.margin > 0 ? '+' : ''}${r.margin.toLocaleString('de-DE')} %` : '—'}
                    </span>
                  </div>
                  {r.lowestBuy && r.highestSell && (
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="label">{t('market.cheapest')}</dt>
                        <dd>
                          <Money value={r.lowestBuy.price} className="text-ink" />{' '}
                          <CityLink id={r.lowestBuy.city.id} name={r.lowestBuy.city.name} tone="neon" />
                        </dd>
                      </div>
                      <div>
                        <dt className="label">{t('market.priciest')}</dt>
                        <dd>
                          <Money value={r.highestSell.price} className="text-ink" />{' '}
                          <CityLink id={r.highestSell.city.id} name={r.highestSell.city.name} tone="brass" />
                        </dd>
                      </div>
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {rows[0]?.lowestBuy && (
            <p className="mt-3 text-xs text-ink-faint">
              {t('market.updated', { when: formatRelative(rows[0].lowestBuy.updatedAt) })} ·{' '}
              <Link to="/reisen" className="text-brass hover:underline">
                {t('city.toTravel')}
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
