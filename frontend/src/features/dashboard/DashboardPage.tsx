import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Flame, Handshake, Landmark, Newspaper, Route, Star, TrendingUp, Users, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClan, useMarket, useNotifications, useTicker } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { CityArt } from '@/components/ui/CityArt';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CommodityIcon } from '@/components/ui/CommodityIcon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney, formatNumber, percentDelta, toCents } from '@/lib/money';
import { formatClock, formatRelative } from '@/lib/time';
import { TravelProgress } from '@/features/city/TravelProgress';
import { NotificationIcon } from '@/features/notifications/NotificationIcon';
import { heatLevel } from '@/lib/heat';

export function DashboardPage() {
  const { t } = useTranslation();
  const { player, city, traveling, travel, destination, cityById } = useGame();
  const market = useMarket(city?.slug);
  const notifications = useNotifications();
  const ticker = useTicker();
  const clan = useClan(player?.clanId);

  if (!player) return null;
  const deals = (market.data ?? [])
    .map((m) => ({ m, d: percentDelta(m.buyPrice, m.commodity.basePrice) ?? 0 }))
    .filter((x) => x.d < 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  const shown = traveling ? destination : city;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="panel noise relative overflow-hidden">
        {shown && <CityArt slug={shown.slug} className="absolute inset-0" />}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="relative flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="label text-brass/90">{shown?.country}</p>
            <h1 className="mt-1 text-3xl font-bold text-ink sm:text-4xl">{t('dashboard.greeting', { name: player.name })}</h1>
            <p className="mt-2 text-ink-muted">
              {traveling
                ? t('dashboard.subtitleTravel', { city: destination?.name ?? '…' })
                : t('dashboard.subtitleIn', { city: city?.name ?? '…' })}
            </p>
          </div>
          {!traveling && (
            <div className="flex flex-wrap gap-2">
              <Link to="/handel">
                <Button variant="primary" size="lg">
                  <Handshake className="h-5 w-5" />
                  {t('dashboard.quickTrade')}
                </Button>
              </Link>
              <Link to="/reisen">
                <Button size="lg" className="bg-bg/60 backdrop-blur">
                  <Route className="h-5 w-5" />
                  {t('dashboard.quickTravel')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {traveling && travel && <TravelProgress travel={travel} from={cityById(travel.fromCityId)} to={destination} />}

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('stats.cash')} value={formatMoney(player.cash)} tone="neon" icon={<Wallet className="h-4 w-4" />} />
        <StatTile
          label={t('stats.bank')}
          value={formatMoney(player.bank)}
          icon={<Landmark className="h-4 w-4" />}
          hint={<Link to="/konto" className="text-brass hover:underline">{t('account.history')}</Link>}
        />
        <StatTile
          label={t('stats.level')}
          value={player.level}
          tone="brass"
          icon={<Star className="h-4 w-4" />}
          hint={
            <div className="space-y-1">
              <ProgressBar value={player.experience / Math.max(1, player.experienceForNextLevel)} size="xs" />
              <span className="num">
                {formatNumber(player.experience)} / {formatNumber(player.experienceForNextLevel)} XP
              </span>
            </div>
          }
        />
        <StatTile
          label={t('stats.heat')}
          value={`${player.heat}`}
          tone={player.heat >= 50 ? 'danger' : 'default'}
          icon={<Flame className="h-4 w-4" />}
          hint={t(`heat.${heatLevel(player.heat)}`)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Heiße Ware */}
          {!traveling && city && (
            <Panel
              title={t('dashboard.bestDeals', { city: city.name })}
              icon={<TrendingUp className="h-4 w-4" />}
              actions={<span className="hidden text-xs text-ink-faint sm:inline">{t('dashboard.bestDealsHint')}</span>}
              padded={false}
            >
              {market.isPending ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : deals.length ? (
                <ul className="divide-y divide-line/5">
                  {deals.map(({ m, d }) => (
                    <li key={m.commodity.id}>
                      <Link
                        to={`/handel?ware=${m.commodity.slug}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
                      >
                        <CommodityIcon slug={m.commodity.slug} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">{m.commodity.name}</p>
                          <p className="text-xs text-ink-muted">
                            {t('trade.available')}: <span className="num">{formatNumber(m.supply)}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <Money value={m.buyPrice} className="font-semibold text-ink" />
                          <p className="num text-xs text-neon">{d.toLocaleString('de-DE')} %</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-ink-faint" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Heute keine Schnäppchen." hint="Vielleicht lohnt sich eine andere Stadt." />
              )}
            </Panel>
          )}

          {/* Schlagzeilen */}
          <Panel title={t('dashboard.news')} icon={<Newspaper className="h-4 w-4" />} padded={false}>
            <ul className="divide-y divide-line/5">
              {(ticker.data ?? []).slice(0, 6).map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
                  <span className="num shrink-0 text-ink-faint">{formatClock(e.createdAt)}</span>
                  <span className="text-ink-muted">{e.text}</span>
                </li>
              ))}
              {ticker.isPending && <Skeleton className="m-4 h-20" />}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          {/* Clan */}
          <Panel title={t('dashboard.clanBox')} icon={<Users className="h-4 w-4" />}>
            {player.clanId && clan.data ? (
              <Link to={`/clans/${clan.data.id}`} className="block space-y-3">
                <div className="flex items-center gap-3">
                  <Badge tone="brass">{clan.data.tag}</Badge>
                  <span className="font-semibold text-ink">{clan.data.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="label">{t('clans.members')}</p>
                    <p className="num text-ink">{clan.data.memberCount}</p>
                  </div>
                  <div>
                    <p className="label">{t('clans.bank')}</p>
                    <Money value={clan.data.bank} className="text-ink" />
                  </div>
                </div>
              </Link>
            ) : player.clanId ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="space-y-3 text-sm text-ink-muted">
                <p>{t('dashboard.noClan')}</p>
                <Link to="/clans">
                  <Button size="sm" variant="outline">
                    {t('dashboard.findClan')}
                  </Button>
                </Link>
              </div>
            )}
          </Panel>

          {/* Meldungen */}
          <Panel
            title={t('dashboard.latest')}
            icon={<Bell className="h-4 w-4" />}
            actions={
              <Link to="/meldungen" className="text-xs text-brass hover:underline">
                {t('dashboard.allNotifications')}
              </Link>
            }
            padded={false}
          >
            <ul className="divide-y divide-line/5">
              {(notifications.data ?? []).slice(0, 5).map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <NotificationIcon kind={n.kind} />
                  <div className="min-w-0">
                    <p className={n.readAt ? 'text-sm text-ink-muted' : 'text-sm font-semibold text-ink'}>{n.title}</p>
                    <p className="text-xs text-ink-faint">{formatRelative(n.createdAt)}</p>
                  </div>
                </li>
              ))}
              {notifications.data?.length === 0 && <li className="p-4 text-sm text-ink-muted">{t('notifications.empty')}</li>}
            </ul>
          </Panel>

          <Panel title={t('stats.reputation')} icon={<Star className="h-4 w-4" />}>
            <p className="num text-2xl font-semibold text-brass">{formatNumber(player.reputation)}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {t('stats.wealth')}: <Money value={toCents(player.cash) + toCents(player.bank)} />
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
