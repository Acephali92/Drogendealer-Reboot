import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTicker } from '@/api/queries';
import { formatClock } from '@/lib/time';

/** Live-Laufband wie im Original: „11:07:18 TORSETEN erreicht die Stadt Portsmouth.“ */
export function Ticker() {
  const { t } = useTranslation();
  const { data } = useTicker();
  const items = data?.slice(0, 12) ?? [];
  return (
    <div className="relative flex h-8 items-center overflow-hidden border-b border-brass/20 bg-gradient-to-r from-[#2a1d0e] via-[#1a130b] to-[#2a1d0e] text-xs">
      <div className="z-10 flex h-full shrink-0 items-center gap-1.5 bg-[#2a1d0e] pl-3 pr-3 font-semibold uppercase tracking-wider text-brass shadow-[8px_0_12px_#2a1d0e]">
        <Radio className="h-3.5 w-3.5 animate-pulse-dot text-danger" aria-hidden />
        {t('notifications.ticker')}
      </div>
      {items.length > 0 && (
        <div className="flex min-w-0 flex-1 overflow-hidden" aria-live="off">
          <div className="flex shrink-0 animate-ticker gap-10 whitespace-nowrap pl-4 hover:[animation-play-state:paused]">
            {[...items, ...items].map((e, i) => (
              <span key={`${e.id}-${i}`} className="text-ink-muted" aria-hidden={i >= items.length}>
                <span className="num mr-2 font-semibold text-ink">{formatClock(e.createdAt)}</span>
                {e.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
