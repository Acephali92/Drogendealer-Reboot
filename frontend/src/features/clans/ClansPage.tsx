import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Crown, Plus, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAnswerInvite, useClans, useCreateClan, useInvites } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney } from '@/lib/money';
import { formatRelative } from '@/lib/time';
import { errorMessage } from '@/lib/errors';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/cn';

/** Gründungskosten laut Mock; wird durch Backend-Wert ersetzt (siehe API-CONTRACT.md). */
const FOUNDING_COST = '1000000';

export function ClansPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { player } = useGame();
  const clans = useClans();
  const invites = useInvites();
  const answer = useAnswerInvite();
  const create = useCreateClan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', tag: '', description: '' });

  if (!player) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(form, {
      onSuccess: (c) => {
        toast.success(t('clans.created', { tag: c.tag, name: c.name }));
        setOpen(false);
        navigate(`/clans/${c.id}`);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('clans.title')}
        subtitle={t('clans.subtitle')}
        actions={
          player.clanId ? (
            <Link to={`/clans/${player.clanId}`}>
              <Button variant="primary">
                <Users className="h-4 w-4" />
                {t('clans.mine')}
              </Button>
            </Link>
          ) : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('clans.create')}
            </Button>
          )
        }
      />

      {!player.clanId && !!invites.data?.length && (
        <Panel title={t('clans.invites')} className="ring-1 ring-brass/30" padded={false}>
          <ul className="divide-y divide-line/5">
            {invites.data.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 p-4">
                <Badge tone="brass">{inv.clan.tag}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{inv.clan.name}</p>
                  <p className="text-xs text-ink-muted">
                    {t('clans.invitedBy', { name: inv.invitedByName })} · {formatRelative(inv.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="neon"
                    loading={answer.isPending && answer.variables?.id === inv.id && answer.variables.accept}
                    onClick={() =>
                      answer.mutate(
                        { id: inv.id, accept: true },
                        {
                          onSuccess: () => {
                            toast.success(t('clans.joined'));
                            navigate(`/clans/${inv.clan.id}`);
                          },
                          onError: (e) => toast.error(errorMessage(e)),
                        },
                      )
                    }
                  >
                    <Check className="h-4 w-4" />
                    {t('clans.accept')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => answer.mutate({ id: inv.id, accept: false }, { onError: (e) => toast.error(errorMessage(e)) })}
                  >
                    <X className="h-4 w-4" />
                    {t('clans.decline')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {clans.isError && <ErrorState error={clans.error} onRetry={() => clans.refetch()} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clans.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40" />)}
        {clans.data?.length === 0 && <EmptyState title={t('clans.noClans')} className="sm:col-span-2 xl:col-span-3" />}
        {clans.data?.map((c, i) => (
          <Link
            key={c.id}
            to={`/clans/${c.id}`}
            style={{ animationDelay: `${i * 40}ms` }}
            className={cn(
              'panel group animate-fade-up p-5 transition hover:-translate-y-0.5 hover:shadow-glow',
              c.id === player.clanId && 'ring-1 ring-brass/50',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-brass/30 to-brass-dim/10 font-display text-lg font-bold text-brass ring-1 ring-brass/30">
                {c.tag}
              </div>
              <span className="label">#{i + 1}</span>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-ink">{c.name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <Crown className="h-3.5 w-3.5 text-brass" aria-hidden />
              {c.leaderName}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t('clans.memberCount', { count: c.memberCount })}</span>
              <Money value={c.wealth} className="font-semibold text-neon" />
            </div>
          </Link>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('clans.create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="primary" type="submit" form="create-clan" loading={create.isPending}>
              {t('clans.create')}
            </Button>
          </>
        }
      >
        <form id="create-clan" onSubmit={submit} className="space-y-4">
          <Field label={t('clans.name')} value={form.name} maxLength={32} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field
            label={t('clans.tag')}
            value={form.tag}
            maxLength={5}
            hint={t('clans.tagHint')}
            onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
          />
          <Field
            label={t('clans.description')}
            value={form.description}
            maxLength={200}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <p className="text-xs text-ink-muted">{t('clans.createCost', { cost: formatMoney(FOUNDING_COST) })}</p>
        </form>
      </Modal>
    </div>
  );
}
