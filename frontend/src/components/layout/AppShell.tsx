import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications, useOnline } from '@/api/queries';
import { useLogout } from '@/features/auth/useLogout';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { MOBILE_PRIMARY, NAV_GROUPS, type NavItem } from './nav';
import { Logo } from './Logo';
import { Ticker } from './Ticker';
import { TopBar } from './TopBar';
import { mockMode } from '@/lib/env';

function SideLink({ item, badge }: { item: NavItem; badge?: number }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-brass/10 text-brass' : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r bg-brass shadow-glow" />}
          <Icon className="h-[18px] w-[18px]" aria-hidden />
          <span className="flex-1">{t(`nav.${item.key}`)}</span>
          {!!badge && <span className="num rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{badge}</span>}
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const unread = useNotifications().data?.filter((n) => !n.readAt).length ?? 0;
  const online = useOnline().data?.count;
  const logout = useLogout();
  const all = NAV_GROUPS.flatMap((g) => g.items);
  const primary = all.filter((i) => MOBILE_PRIMARY.includes(i.to));
  const moreActive = !MOBILE_PRIMARY.includes(location.pathname);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Sidebar ab Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line/10 bg-surface/70 backdrop-blur-md lg:flex">
        <div className="flex h-[88px] items-center px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Hauptnavigation">
          {NAV_GROUPS.map((g) => (
            <div key={g.key}>
              <p className="label mb-2 px-3">{t(`nav.${g.key}`)}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <SideLink key={item.to} item={item} badge={item.key === 'notifications' ? unread : undefined} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-line/10 p-4">
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-neon" />
              {online !== undefined ? t('app.online', { count: online }) : '…'}
            </span>
            {mockMode !== 'off' && <Badge tone="warn">{t('app.mockBadge')}</Badge>}
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <Ticker />
      <TopBar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 lg:px-8 lg:pb-12 lg:pt-8">
        <Outlet />
      </main>

      {/* Mobile Bottom-Navigation */}
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {primary.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                  isActive ? 'text-brass' : 'text-ink-faint',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              {t(`nav.${item.key}`)}
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
            moreActive ? 'text-brass' : 'text-ink-faint',
          )}
        >
          <Menu className="h-5 w-5" aria-hidden />
          {t('app.more')}
          {unread > 0 && <span className="absolute right-[30%] top-2 h-2 w-2 rounded-full bg-danger" />}
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={t('app.more')}>
        <div className="space-y-5">
          {NAV_GROUPS.map((g) => (
            <div key={g.key}>
              <p className="label mb-2">{t(`nav.${g.key}`)}</p>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'relative flex flex-col items-center gap-2 rounded-xl p-3 text-xs font-medium ring-1 ring-line/10',
                          isActive ? 'bg-brass/10 text-brass ring-brass/30' : 'bg-surface-2 text-ink-muted',
                        )
                      }
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                      {t(`nav.${item.key}`)}
                      {item.key === 'notifications' && unread > 0 && (
                        <span className="num absolute right-2 top-2 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink-muted ring-1 ring-line/10"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('nav.logout')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
