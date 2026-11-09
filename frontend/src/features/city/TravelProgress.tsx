import { useEffect, useState } from 'react';
import { Car, Flag, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { City, Travel } from '@/api/types';
import { Countdown } from '@/components/ui/Countdown';
import { progressBetween } from '@/lib/time';
import { useArrivalRefresh } from '@/features/game/useGame';

/** Reisefortschritt mit animiertem Fahrzeug zwischen Start und Ziel. */
export function TravelProgress({ travel, from, to }: { travel: Travel; from: City | null; to: City | null }) {
  const { t } = useTranslation();
  const onArrive = useArrivalRefresh();
  const [p, setP] = useState(() => progressBetween(travel.departedAt, travel.arrivesAt));
  useEffect(() => {
    const id = window.setInterval(() => setP(progressBetween(travel.departedAt, travel.arrivesAt)), 250);
    return () => window.clearInterval(id);
  }, [travel.departedAt, travel.arrivesAt]);

  return (
    <div className="panel overflow-hidden p-5 ring-1 ring-info/20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-info">{t('travel.onTheRoad', { city: to?.name ?? '…' })}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('trade.traveling')}</p>
        </div>
        <div className="text-right">
          <p className="label">{t('travel.arrivesIn')}</p>
          <Countdown
            to={travel.arrivesAt}
            onDone={() => onArrive(to?.name)}
            className="num text-3xl font-bold text-info"
          />
        </div>
      </div>
      <div className="relative mt-6 h-10">
        <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(var(--ink-faint)/.6)_0_10px,transparent_10px_18px)]" />
        <div
          className="absolute inset-y-0 left-4 top-1/2 h-0.5 -translate-y-1/2 bg-info shadow-[0_0_12px_rgb(var(--info))]"
          style={{ width: `calc((100% - 2rem) * ${p})` }}
        />
        <MapPin className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Flag className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-brass" aria-hidden />
        <Car
          className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-info drop-shadow-[0_0_8px_rgb(var(--info))] transition-[left] duration-300 ease-linear"
          style={{ left: `calc(1rem + (100% - 2rem) * ${p})` }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>{from?.name}</span>
        <span>{to?.name}</span>
      </div>
    </div>
  );
}
