import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Car, Clock, Fuel, Search, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CityConnection } from '@/api/types';
import { useCity, useStartTravel, useVehicles } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { PageHeader } from '@/components/layout/PageHeader';
import { CityArt } from '@/components/ui/CityArt';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney, formatNumber, toCents } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import { errorMessage } from '@/lib/errors';
import { toast } from '@/stores/toast';
import { TravelProgress } from './TravelProgress';

export function TravelPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { player, city, traveling, travel, destination, cityById } = useGame();
  const detail = useCity(city?.slug);
  const vehicles = useVehicles();
  const start = useStartTravel();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'distance' | 'name'>('distance');
  const [target, setTarget] = useState<CityConnection | null>(null);

  const list = useMemo(() => {
    const rows = (detail.data?.connections ?? [])
      .map((c) => ({ c, city: cityById(c.toCityId) }))
      .filter((x) => x.city && x.city.name.toLowerCase().includes(q.trim().toLowerCase()));
    return sort === 'name' ? rows.sort((a, b) => a.city!.name.localeCompare(b.city!.name, 'de')) : rows;
  }, [detail.data, q, sort, cityById]);

  if (traveling && travel) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('travel.title')} />
        <TravelProgress travel={travel} from={cityById(travel.fromCityId)} to={destination} />
      </div>
    );
  }
  if (!player || !city) return null;
  const vehicle = vehicles.data?.find((v) => v.isActive);
  const targetCity = target ? cityById(target.toCityId) : null;

  return (
    <div>
      <PageHeader
        title={t('travel.title')}
        subtitle={t('travel.subtitle', { city: city.name })}
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted ring-1 ring-line/10">
            <Car className="h-4 w-4 text-brass" aria-hidden />
            {vehicle ? t('travel.with', { vehicle: vehicle.vehicleType.name }) : t('travel.withBus')}
          </span>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <span className="sr-only">{t('travel.search')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('travel.search')}
            className="h-10 w-full rounded-lg bg-surface-2 pl-9 pr-3 text-sm text-ink ring-1 ring-line/15 placeholder:text-ink-faint focus:outline-none focus:ring-brass/50"
          />
        </label>
        <Tabs
          value={sort}
          onChange={setSort}
          items={[
            { value: 'distance', label: t('travel.sortDistance') },
            { value: 'name', label: t('travel.sortName') },
          ]}
        />
      </div>

      {detail.isError && <ErrorState error={detail.error} onRetry={() => detail.refetch()} />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {detail.isPending && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}
        {list.map(({ c, city: dest }, i) => {
          const tooExpensive = toCents(c.cost) > toCents(player.cash);
          return (
            <button
              key={c.toCityId}
              onClick={() => setTarget(c)}
              disabled={tooExpensive}
              style={{ animationDelay: `${i * 25}ms` }}
              className="panel group relative animate-fade-up overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-glow disabled:opacity-50"
            >
              <div className="relative h-20 overflow-hidden">
                <CityArt slug={dest!.slug} className="absolute inset-0 transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                <span className="absolute bottom-2 left-4 font-display text-lg font-bold text-ink">{dest!.name}</span>
                <span className="absolute right-3 top-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-ink-muted backdrop-blur">
                  <Shield className="h-3 w-3" aria-hidden /> {dest!.policeStrength}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 px-4 pb-4 pt-2 text-xs">
                <div>
                  <dt className="label flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 rotate-90" aria-hidden />
                    {t('travel.distance')}
                  </dt>
                  <dd className="num mt-0.5 text-sm text-ink">{formatNumber(c.distanceKm)} km</dd>
                </div>
                <div>
                  <dt className="label flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {t('travel.duration')}
                  </dt>
                  <dd className="num mt-0.5 text-sm text-ink">{formatDuration(c.durationSeconds)}</dd>
                </div>
                <div>
                  <dt className="label flex items-center gap-1">
                    <Fuel className="h-3 w-3" aria-hidden />
                    {t('travel.cost')}
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <Money value={c.cost} className={tooExpensive ? 'text-danger' : 'text-ink'} />
                  </dd>
                </div>
              </dl>
              {tooExpensive && (
                <p className="border-t border-danger/20 bg-danger/5 px-4 py-2 text-xs text-danger">{t('travel.noFuelMoney')}</p>
              )}
            </button>
          );
        })}
      </div>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={t('travel.confirmTitle', { city: targetCity?.name ?? '' })}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={start.isPending}
              data-autofocus
              onClick={() =>
                target &&
                start.mutate(target.toCityId, {
                  onSuccess: () => {
                    toast.info(t('travel.started', { city: targetCity?.name }));
                    setTarget(null);
                    navigate('/');
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Car className="h-4 w-4" />
              {t('travel.go')}
            </Button>
          </>
        }
      >
        {target && (
          <p className="text-sm text-ink-muted">
            {t('travel.confirmBody', { duration: formatDuration(target.durationSeconds), cost: formatMoney(target.cost) })}
          </p>
        )}
      </Modal>
    </div>
  );
}
