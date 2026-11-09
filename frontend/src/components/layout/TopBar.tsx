import { Link, NavLink } from 'react-router-dom';
import { Bell, Flame, HeartPulse, Landmark, MapPin, Package, Route, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/api/queries';
import { useGame, useArrivalRefresh } from '@/features/game/useGame';
import { Money } from '@/components/ui/Money';
import { Countdown } from '@/components/ui/Countdown';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Avatar } from '@/components/ui/Avatar';
import { formatWeight } from '@/lib/money';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

function heatTone(h: number) {
  return h >= 75 ? 'text-danger' : h >= 50 ? 'text-brass' : h >= 25 ? 'text-warn' : 'text-ink-muted';
}

export function TopBar() {
  const { t } = useTranslation();
  const { player, city, traveling, travel, destination, cargo } = useGame();
  const notifications = useNotifications();
  const unread = notifications.data?.unreadCount ?? 0;
  const onArrive = useArrivalRefresh();

  return (
    <header className="sticky top-0 z-30 border-b border-line/10 bg-bg/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <Link to="/" className="lg:hidden" aria-label={t('nav.dashboard')}>
          <Logo compact />
        </Link>

        {/* Standort / Reise */}
        <div className="min-w-0 flex-1 lg:flex-none">
          {traveling && travel ? (
            <Link
              to="/reisen"
              className="flex min-w-0 items-center gap-2 rounded-lg bg-info/10 px-2.5 py-1.5 text-sm text-info ring-1 ring-info/30"
            >
              <Route className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{destination?.name ?? '…'}</span>
              <Countdown to={travel.arrivesAt} onDone={() => onArrive(destination?.name)} className="num font-semibold" />
            </Link>
          ) : (
            <Link
              to="/stadt"
              className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink hover:bg-surface-3"
            >
              <MapPin className="h-4 w-4 shrink-0 text-brass" aria-hidden />
              <span className="truncate">{city?.name ?? '—'}</span>
            </Link>
          )}
        </div>

        {/* Kennzahlen */}
        {player && (
          <dl className="hidden flex-1 items-center justify-end gap-5 text-sm md:flex">
            <div className="flex items-center gap-2" title={t('stats.cash')}>
              <Wallet className="h-4 w-4 text-neon" aria-hidden />
              <dt className="sr-only">{t('stats.cash')}</dt>
              <dd>
                <Money value={player.cash} className="font-semibold text-neon" />
              </dd>
            </div>
            <div className="hidden items-center gap-2 xl:flex" title={t('stats.bank')}>
              <Landmark className="h-4 w-4 text-ink-faint" aria-hidden />
              <dt className="sr-only">{t('stats.bank')}</dt>
              <dd>
                <Money value={player.bank} className="text-ink-muted" />
              </dd>
            </div>
            {cargo && (
              <div className="flex w-36 items-center gap-2" title={t('stats.cargo')}>
                <Package className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                <dt className="sr-only">{t('stats.cargo')}</dt>
                <dd className="w-full">
                  <div className="num flex justify-between text-[11px] text-ink-muted">
                    <span>{formatWeight(cargo.free)}</span>
                    <span className="text-ink-faint">frei</span>
                  </div>
                  <ProgressBar value={cargo.capacity ? cargo.used / cargo.capacity : 0} tone="auto" size="xs" />
                </dd>
              </div>
            )}
            <div className="flex w-28 items-center gap-2" title={t('stats.health')}>
              <HeartPulse className="h-4 w-4 shrink-0 text-danger" aria-hidden />
              <dt className="sr-only">{t('stats.health')}</dt>
              <dd className="w-full">
                <div className="num text-[11px] text-ink-muted">
                  {player.health}/{player.maxHealth}
                </div>
                <ProgressBar value={player.health / player.maxHealth} tone="danger" size="xs" />
              </dd>
            </div>
            <div className={cn('flex items-center gap-1.5', heatTone(player.heat))} title={t('stats.heat')}>
              <Flame className="h-4 w-4" aria-hidden />
              <dt className="sr-only">{t('stats.heat')}</dt>
              <dd className="num font-semibold">{player.heat}</dd>
            </div>
          </dl>
        )}

        <div className="flex items-center gap-1">
          <NavLink
            to="/meldungen"
            className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-muted hover:bg-surface-3 hover:text-ink"
            aria-label={`${t('nav.notifications')}${unread ? ` (${unread})` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
          {player && (
            <Link to="/konto" className="rounded-xl p-1 hover:bg-surface-3" aria-label={t('nav.account')}>
              <Avatar name={player.name} size={32} />
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Kennzahlenleiste */}
      {player && (
        <div className="scrollbar-none flex items-center gap-4 overflow-x-auto border-t border-line/5 px-4 py-1.5 text-xs md:hidden">
          <span className="flex shrink-0 items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-neon" aria-hidden />
            <Money value={player.cash} className="font-semibold text-neon" />
          </span>
          {cargo && (
            <span className="flex shrink-0 items-center gap-1.5 text-ink-muted">
              <Package className="h-3.5 w-3.5" aria-hidden />
              <span className="num">{formatWeight(cargo.free)} frei</span>
            </span>
          )}
          <span className="flex shrink-0 items-center gap-1.5 text-ink-muted">
            <HeartPulse className="h-3.5 w-3.5 text-danger" aria-hidden />
            <span className="num">{player.health}</span>
          </span>
          <span className={cn('flex shrink-0 items-center gap-1', heatTone(player.heat))}>
            <Flame className="h-3.5 w-3.5" aria-hidden />
            <span className="num">{player.heat}</span>
          </span>
        </div>
      )}
    </header>
  );
}
