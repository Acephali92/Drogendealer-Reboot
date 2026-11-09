import { Link } from 'react-router-dom';
import { Car, Crosshair, Handshake, HeartPulse, Landmark, LineChart, Route, ShieldAlert, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useEquipment, useVehicles } from '@/api/queries';
import { useGame } from '@/features/game/useGame';
import { Panel } from '@/components/ui/Panel';
import { CityArt } from '@/components/ui/CityArt';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { formatNumber, formatWeight } from '@/lib/money';
import { cn } from '@/lib/cn';
import { TravelProgress } from './TravelProgress';

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function ActionCard({ to, icon, title, sub, accent }: { to: string; icon: ReactNode; title: string; sub?: ReactNode; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'panel group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-glow',
        accent && 'ring-1 ring-brass/30',
      )}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brass/10 text-brass ring-1 ring-brass/25 transition group-hover:bg-brass/20">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink">{title}</span>
        {sub && <span className="block truncate text-xs text-ink-muted">{sub}</span>}
      </span>
    </Link>
  );
}

export function CityPage() {
  const { t } = useTranslation();
  const { player, city, traveling, travel, destination, cityById, cargo } = useGame();
  const vehicles = useVehicles();
  const equipment = useEquipment();
  if (!player) return null;

  if (traveling && travel) {
    return <TravelProgress travel={travel} from={cityById(travel.fromCityId)} to={destination} />;
  }
  if (!city) return <EmptyState title={t('city.notInCity')} />;

  const active = vehicles.data?.find((v) => v.isActive);
  const weapon = equipment.data?.find((e) => e.equipped && e.equipmentType.slot === 'WEAPON');

  return (
    <div className="space-y-6">
      <section className="panel noise relative h-56 overflow-hidden sm:h-72">
        <CityArt slug={city.slug} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-end justify-between gap-3 p-5 sm:p-7">
          <div>
            <p className="label text-brass">{t('city.title')}</p>
            {/* Ortsschild-Optik als Reminiszenz ans Original */}
            <h1 className="mt-2 inline-block rounded-lg border-2 border-black/60 bg-gradient-to-b from-[#ffd23f] to-[#f2b705] px-4 py-1 font-display text-3xl font-bold text-black shadow-[0_0_0_3px_#ffd23f55,0_10px_30px_-8px_#000] sm:text-4xl">
              {city.name}
            </h1>
            <p className="mt-3 max-w-lg text-sm text-ink-muted">{city.description}</p>
          </div>
          <div className="flex gap-2">
            <Badge tone="neutral">{city.country}</Badge>
            <Badge tone={city.policeStrength >= 60 ? 'danger' : city.policeStrength >= 40 ? 'warn' : 'neon'}>
              <ShieldAlert className="h-3 w-3" /> {city.policeStrength}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title={t('city.yourPosition')} className="lg:col-span-3">
          <dl className="divide-y divide-line/5">
            <Row label={t('stats.techLevel')}>
              <span className="num">{city.techLevel}</span>
            </Row>
            <Row label={t('stats.population')}>
              <span className="num">{formatNumber(city.population)}</span>
            </Row>
            <Row label={t('stats.cash')}>
              <span className="inline-flex items-center gap-2">
                <Wallet className="h-4 w-4 text-neon" aria-hidden />
                <Money value={player.cash} className="font-semibold text-neon" />
              </span>
            </Row>
            <Row label={t('stats.bank')}>
              <span className="inline-flex items-center gap-2">
                <Landmark className="h-4 w-4 text-ink-faint" aria-hidden />
                <Money value={player.bank} />
              </span>
            </Row>
            <Row label={t('stats.health')}>
              <span className="inline-flex w-40 items-center gap-2">
                <HeartPulse className="h-4 w-4 text-danger" aria-hidden />
                <ProgressBar value={player.health / player.maxHealth} tone="danger" />
                <span className="num text-xs">{player.health}</span>
              </span>
            </Row>
            <Row label={t('city.insurance')}>
              <Badge tone="neutral">{t('city.insuranceSoon')}</Badge>
            </Row>
            {cargo && (
              <Row label={t('stats.freeCargo')}>
                <span className="num">{formatWeight(cargo.capacity - cargo.used)}</span>
              </Row>
            )}
          </dl>
        </Panel>

        <div className="space-y-3 lg:col-span-2">
          <p className="label px-1">{t('city.actions')}</p>
          <ActionCard to="/handel" icon={<Handshake className="h-5 w-5" />} title={t('city.toMarket')} sub={t('trade.subtitle')} accent />
          <ActionCard to="/reisen" icon={<Route className="h-5 w-5" />} title={t('city.toTravel')} />
          <ActionCard
            to="/fahrzeuge"
            icon={<Car className="h-5 w-5" />}
            title={t('city.toVehicles')}
            sub={active ? `${active.vehicleType.name} · ${formatWeight(active.vehicleType.capacityG)}` : t('vehicles.noVehicle')}
          />
          <ActionCard
            to="/waffen"
            icon={<Crosshair className="h-5 w-5" />}
            title={t('city.toWeapons')}
            sub={weapon ? weapon.equipmentType.name : '—'}
          />
          <ActionCard to="/markt" icon={<LineChart className="h-5 w-5" />} title={t('nav.market')} />
        </div>
      </div>
    </div>
  );
}
