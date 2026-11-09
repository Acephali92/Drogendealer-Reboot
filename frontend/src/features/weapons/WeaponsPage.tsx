import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Weight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBuyEquipment, useEquipment, useEquipmentTypes } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Feedback';
import { EquipmentImage } from '@/components/ui/GameImages';
import { formatWeight, toCents } from '@/lib/money';
import { errorMessage } from '@/lib/errors';
import { toast } from '@/stores/toast';

const VISIBLE_FROM_G = 2000;

export function WeaponsPage() {
  const { t } = useTranslation();
  const { player, city, cargo, traveling } = useGame();
  const types = useEquipmentTypes();
  const owned = useEquipment();
  const buy = useBuyEquipment();
  const [slot, setSlot] = useState<'WEAPON' | 'ARMOR'>('WEAPON');
  if (!player) return null;
  const list = (types.data ?? [])
    .filter((e) => e.slot === slot)
    .sort((a, b) => Number(toCents(a.price) - toCents(b.price)));
  const maxPower = Math.max(1, ...(types.data ?? []).map((e) => Math.max(e.attack, e.defense)));
  const free = cargo?.free ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('weapons.title')}
        subtitle={city ? t('weapons.subtitle', { city: city.name }) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('weapons.balance')} className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('stats.cash')}</dt>
              <dd>
                <Money value={player.cash} className="font-semibold text-neon" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('stats.bank')}</dt>
              <dd>
                <Money value={player.bank} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">{t('stats.freeCargo')}</dt>
              <dd className="num">{formatWeight(free)}</dd>
            </div>
          </dl>
        </Panel>
        <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-ink-muted lg:col-span-2">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden />
          <p>{t('weapons.warning')}</p>
        </div>
      </div>

      <Tabs
        value={slot}
        onChange={setSlot}
        items={[
          { value: 'WEAPON', label: t('weapons.weaponsTab') },
          { value: 'ARMOR', label: t('weapons.armorTab') },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {types.isPending && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44" />)}
        {list.map((e, i) => {
          const count = owned.data?.filter((o) => o.equipmentType.id === e.id).length ?? 0;
          const power = e.slot === 'WEAPON' ? e.attack : e.defense;
          const poor = toCents(e.price) > toCents(player.cash);
          const heavy = free !== null && e.weightG !== null && e.weightG > free;
          const hidden = e.weightG !== null && e.weightG < VISIBLE_FROM_G;
          return (
            <article
              key={e.id}
              className="panel animate-fade-up overflow-hidden"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <header className="panel-header">
                <h2 className="font-display font-semibold text-ink">{e.name}</h2>
                {count > 0 && <Badge tone="brass">{t('weapons.owned', { n: count })}</Badge>}
              </header>
              <div className="flex gap-4 p-4">
                <EquipmentImage type={e} size={64} />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm text-ink-muted">{e.description}</p>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="label">
                        {e.slot === 'WEAPON' ? t('weapons.firepower') : t('weapons.defense')}
                      </span>
                      <span className="num font-semibold text-ink">{power}</span>
                    </div>
                    <ProgressBar value={power / maxPower} tone={e.slot === 'WEAPON' ? 'danger' : 'info'} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Weight className="h-3.5 w-3.5" aria-hidden />{' '}
                      <span className="num">{formatWeight(e.weightG)}</span>
                    </span>
                    <span className="flex items-center gap-1" title={t('weapons.warning')}>
                      {hidden ? (
                        <EyeOff className="h-3.5 w-3.5 text-neon" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-warn" />
                      )}
                      {hidden ? 'unauffällig' : 'sichtbar'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <Money
                      value={e.price}
                      className={
                        poor ? 'text-lg font-semibold text-danger' : 'text-lg font-semibold text-brass'
                      }
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={poor || heavy || traveling}
                      loading={buy.isPending && buy.variables === e.id}
                      onClick={() =>
                        buy.mutate(e.id, {
                          onSuccess: () => toast.success(t('weapons.bought', { name: e.name })),
                          onError: (err) => toast.error(errorMessage(err)),
                        })
                      }
                    >
                      {t('weapons.buy')}
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
