import { useState } from 'react';
import { Gauge, Lock, Package, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '@/api/types';
import { useActivateVehicle, useBuyVehicle, useSellVehicle, useVehicleTypes, useVehicles } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney, formatWeight, toCents } from '@/lib/money';
import { errorMessage } from '@/lib/errors';
import { toast } from '@/stores/toast';
import { cn } from '@/lib/cn';
import { VehicleArt } from './VehicleArt';

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label flex items-center gap-1">
        {icon}
        {label}
      </dt>
      <dd className="num mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function VehiclesPage() {
  const { t } = useTranslation();
  const { player, traveling } = useGame();
  const types = useVehicleTypes();
  const mine = useVehicles();
  const buy = useBuyVehicle();
  const activate = useActivateVehicle();
  const sell = useSellVehicle();
  const [selling, setSelling] = useState<Vehicle | null>(null);
  if (!player) return null;
  const resale = (v: Vehicle) => (toCents(v.vehicleType.price) * BigInt(Math.round(v.condition * 0.6))) / 100n;

  return (
    <div className="space-y-8">
      <PageHeader title={t('vehicles.title')} subtitle={t('vehicles.subtitle')} />

      <Panel title={t('vehicles.garage')} padded={false}>
        {mine.isPending ? (
          <Skeleton className="m-4 h-32" />
        ) : !mine.data?.length ? (
          <EmptyState title={t('vehicles.noVehicle')} />
        ) : (
          <ul className="grid gap-4 p-4 md:grid-cols-2">
            {mine.data.map((v) => (
              <li
                key={v.id}
                className={cn(
                  'rounded-xl bg-surface-2 p-4 ring-1 transition',
                  v.isActive ? 'ring-brass/50 shadow-glow' : 'ring-line/10',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">{v.vehicleType.name}</p>
                    {v.isActive && <Badge tone="brass">{t('vehicles.active')}</Badge>}
                  </div>
                  <VehicleArt slug={v.vehicleType.slug} className="h-14 w-28 shrink-0" />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  <Spec icon={<Package className="h-3 w-3" />} label={t('vehicles.capacity')} value={formatWeight(v.vehicleType.capacityG)} />
                  <Spec icon={<Gauge className="h-3 w-3" />} label={t('vehicles.speed')} value={`${v.vehicleType.speedKmh} km/h`} />
                  <Spec
                    icon={<Wrench className="h-3 w-3" />}
                    label={t('vehicles.condition')}
                    value={
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        {v.condition}&nbsp;%
                        <ProgressBar value={v.condition / 100} tone={v.condition < 40 ? 'danger' : 'neon'} size="xs" className="w-10" />
                      </span>
                    }
                  />
                </dl>
                <div className="mt-4 flex gap-2">
                  {!v.isActive && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={traveling}
                      loading={activate.isPending && activate.variables === v.id}
                      onClick={() =>
                        activate.mutate(v.id, {
                          onSuccess: () => toast.success(t('vehicles.activated', { name: v.vehicleType.name })),
                          onError: (e) => toast.error(errorMessage(e)),
                        })
                      }
                    >
                      {t('vehicles.activate')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={traveling} onClick={() => setSelling(v)}>
                    {t('vehicles.sell')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-ink">{t('vehicles.dealer')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {types.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-60" />)}
          {types.data?.map((vt, i) => {
            const locked = vt.licenseClass !== null && player.level < vt.licenseClass;
            const poor = toCents(vt.price) > toCents(player.cash);
            return (
              <article key={vt.id} className="panel animate-fade-up overflow-hidden" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="relative grid h-32 place-items-center bg-gradient-to-b from-surface-3/60 to-surface">
                  <VehicleArt slug={vt.slug} className="h-24 w-48" />
                  {vt.licenseClass !== null && (
                    <Badge tone={locked ? 'danger' : 'neutral'} className="absolute left-3 top-3">
                      {locked && <Lock className="h-3 w-3" />}
                      {t('vehicles.licenseClass', { n: vt.licenseClass })}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-ink">{vt.name}</h3>
                    <Money value={vt.price} className={cn('font-semibold', poor ? 'text-danger' : 'text-brass')} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <Spec icon={<Package className="h-3 w-3" />} label={t('vehicles.capacity')} value={formatWeight(vt.capacityG)} />
                    <Spec icon={<Gauge className="h-3 w-3" />} label={t('vehicles.speed')} value={`${vt.speedKmh} km/h`} />
                  </dl>
                  <Button
                    className="mt-4 w-full"
                    variant={locked || poor ? 'outline' : 'primary'}
                    disabled={locked || poor || traveling}
                    loading={buy.isPending && buy.variables === vt.id}
                    onClick={() =>
                      buy.mutate(vt.id, {
                        onSuccess: () => toast.success(t('vehicles.bought', { name: vt.name })),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    {locked ? t('vehicles.licenseLocked', { n: vt.licenseClass }) : t('vehicles.buy')}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Modal
        open={!!selling}
        onClose={() => setSelling(null)}
        title={t('vehicles.sell')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelling(null)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={sell.isPending}
              onClick={() =>
                selling &&
                sell.mutate(selling.id, {
                  onSuccess: () => setSelling(null),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {t('vehicles.sell')}
            </Button>
          </>
        }
      >
        {selling && (
          <p className="text-sm text-ink-muted">
            {t('vehicles.sellConfirm', { name: selling.vehicleType.name, price: formatMoney(resale(selling)) })}
          </p>
        )}
      </Modal>
    </div>
  );
}
