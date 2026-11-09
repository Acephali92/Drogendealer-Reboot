import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LogOut, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useClan, useInviteToClan, useLeaveClan } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { Panel } from '@/components/ui/Panel';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/time';
import { errorMessage } from '@/lib/errors';
import { toast } from '@/stores/toast';
import { canInvite as roleCanInvite, ROLE_ICON, ROLE_ORDER, ROLE_TONE } from './roles';


export function ClanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { player } = useGame();
  const clan = useClan(id);
  const invite = useInviteToClan(id ?? '');
  const leave = useLeaveClan();
  const [name, setName] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (clan.isPending) return <Skeleton className="h-96" />;
  if (clan.isError) return <ErrorState error={clan.error} onRetry={() => clan.refetch()} />;
  const c = clan.data;
  const me = c.members.find((m) => m.playerId === player?.id);
  const canInvite = roleCanInvite(me?.role);
  const godfather = c.members.find((m) => m.role === 'GODFATHER');
  const members = [...c.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.level - a.level);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    invite.mutate(name.trim(), {
      onSuccess: () => {
        toast.success(t('clans.invited', { name: name.trim() }));
        setName('');
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-6">
      <Link to="/clans" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        {t('clans.all')}
      </Link>

      <section className="panel noise relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brass/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brass/40 to-brass-dim/10 font-display text-2xl font-bold text-brass ring-1 ring-brass/40 shadow-glow">
            {c.tag}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{c.name}</h1>
            {c.description && <p className="mt-1 text-ink-muted">{c.description}</p>}
          </div>
          {me && (
            <Button variant="danger" size="sm" onClick={() => setConfirmLeave(true)}>
              <LogOut className="h-4 w-4" />
              {t('clans.leave')}
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('clans.members')} value={c.memberCount} />
        <StatTile label={t('clans.leader')} value={godfather?.name ?? t('clans.noGodfather')} tone="brass" />
        <StatTile
          label={t('clans.bank')}
          value={c.bank !== null ? formatMoney(c.bank) : '—'}
          hint={c.bank === null ? t('clans.bankHidden') : undefined}
          tone="neon"
        />
        <StatTile label={t('clans.founded')} value={formatDateTime(c.createdAt).split(',')[0]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t('clans.members')} padded={false} className="lg:col-span-2">
          <ul className="divide-y divide-line/5">
            {members.map((m) => (
              <li key={m.playerId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {m.name}
                    {m.playerId === player?.id && <span className="ml-2 text-xs text-brass">({t('rankings.you')})</span>}
                  </p>
                  <p className="text-xs text-ink-faint">Level {m.level}</p>
                </div>
                <Badge tone={ROLE_TONE[m.role]}>
                  {ROLE_ICON[m.role]}
                  {t(`clans.roles.${m.role}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>

        {canInvite && (
          <Panel title={t('clans.invite')} icon={<UserPlus className="h-4 w-4" />}>
            <form onSubmit={submit} className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('clans.invitePlaceholder')}
                aria-label={t('clans.invitePlaceholder')}
                className="h-10 min-w-0 flex-1 rounded-lg bg-bg px-3 text-sm text-ink ring-1 ring-line/20 focus:outline-none focus:ring-brass/60"
              />
              <Button type="submit" variant="primary" disabled={!name.trim()} loading={invite.isPending}>
                {t('clans.invite')}
              </Button>
            </form>
          </Panel>
        )}
      </div>

      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={t('clans.leave')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={leave.isPending}
              onClick={() =>
                leave.mutate(c.id, {
                  onSuccess: () => {
                    toast.info(t('clans.left'));
                    navigate('/clans');
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {t('clans.leave')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t('clans.leaveConfirm', { name: c.name })}</p>
      </Modal>
    </div>
  );
}
