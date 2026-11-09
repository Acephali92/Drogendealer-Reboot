import { useState } from 'react';
import { Flame, HeartPulse, LogOut, RotateCcw, Star, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { useLogout } from '@/features/auth/useLogout';
import { useAuth } from '@/stores/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney, formatNumber } from '@/lib/money';
import { formatDateTime } from '@/lib/time';
import { mockMode } from '@/lib/env';
import { heatLevel } from '@/lib/heat';

export function AccountPage() {
  const { t } = useTranslation();
  const { player, city } = useGame();
  const user = useAuth((s) => s.user);
  const tx = useTransactions();
  const logout = useLogout();
  const [reset, setReset] = useState(false);
  if (!player) return null;

  const resetWorld = async () => {
    const { resetState } = await import('@/mocks/store');
    resetState();
    await logout();
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('account.title')} />

      <section className="panel noise flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={player.name} size={80} className="shadow-glow" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-ink">{player.name}</h2>
          <p className="text-sm text-ink-muted">
            {user?.email} · {t('account.memberSince', { date: formatDateTime(player.createdAt) })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="brass">Level {player.level}</Badge>
            <Badge tone="info">{t(`status.${player.status}`)}</Badge>
            {city && <Badge>{city.name}</Badge>}
          </div>
          {player.experienceForNextLevel !== null && (
            <div className="mt-4 max-w-md">
              <ProgressBar value={player.experience / Math.max(1, player.experienceForNextLevel)} />
              <p className="mt-1 text-xs text-ink-muted">
                {t('account.nextLevel', {
                  xp: formatNumber(Math.max(0, player.experienceForNextLevel - player.experience)),
                  level: player.level + 1,
                })}
              </p>
            </div>
          )}
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('stats.reputation')} value={formatNumber(player.reputation)} icon={<Trophy className="h-4 w-4" />} tone="brass" />
        <StatTile label={t('stats.xp')} value={formatNumber(player.experience)} icon={<Star className="h-4 w-4" />} />
        <StatTile
          label={t('stats.health')}
          value={`${player.health}/${player.maxHealth}`}
          icon={<HeartPulse className="h-4 w-4" />}
          tone={player.health < player.maxHealth / 3 ? 'danger' : 'default'}
        />
        <StatTile label={t('stats.heat')} value={player.heat} hint={t(`heat.${heatLevel(player.heat)}`)} icon={<Flame className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t('account.history')} padded={false} className="lg:col-span-2">
          {tx.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : !tx.data?.length ? (
            <EmptyState title={t('account.historyEmpty')} />
          ) : (
            <ul className="max-h-[480px] divide-y divide-line/5 overflow-y-auto">
              {tx.data.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Badge>{t(`account.reasons.${x.reason}`)}</Badge>
                  <span className="flex-1 text-xs text-ink-faint">{formatDateTime(x.createdAt)}</span>
                  <Money value={x.amount} signed colored className="font-semibold" />
                  <span className="num hidden w-28 text-right text-xs text-ink-muted sm:inline">{formatMoney(x.balanceAfter)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('account.settings')}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('account.email')}</dt>
              <dd className="truncate text-ink">{user?.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('account.language')}</dt>
              <dd className="text-ink">Deutsch</dd>
            </div>
          </dl>
          {mockMode !== 'off' && (
            <div className="mt-6 space-y-3 border-t border-line/10 pt-4">
              <p className="label">{t('account.developer')}</p>
              <p className="text-xs text-ink-muted">{t('account.mockMode', { mode: mockMode })}</p>
              <Button size="sm" variant="danger" onClick={() => setReset(true)}>
                <RotateCcw className="h-4 w-4" />
                {t('account.resetWorld')}
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <Modal
        open={reset}
        onClose={() => setReset(false)}
        title={t('account.resetWorld')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReset(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="danger" onClick={resetWorld}>
              {t('app.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t('account.resetConfirm')}</p>
      </Modal>
    </div>
  );
}
