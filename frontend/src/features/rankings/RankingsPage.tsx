import { useState } from 'react';
import { Medal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RankingRow, RankingType } from '@/api/types';
import { useRanking } from '@/api/queries';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { formatMoney, formatNumber } from '@/lib/money';
import { cn } from '@/lib/cn';

const MEDALS = ['text-[#ffd23f]', 'text-[#c9d1d9]', 'text-[#cd7f32]'];

function formatValue(type: RankingType, v: string) {
  return type === 'wealth' || type === 'clans' ? formatMoney(v) : formatNumber(Number(v));
}

function Row({ r, type }: { r: RankingRow; type: RankingType }) {
  const { t } = useTranslation();
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        r.isMe && 'bg-brass/10 ring-1 ring-inset ring-brass/30',
      )}
    >
      <span className="num w-8 shrink-0 text-center font-semibold text-ink-muted">
        {r.rank <= 3 ? (
          <Medal className={cn('mx-auto h-5 w-5', MEDALS[r.rank - 1])} aria-label={`Platz ${r.rank}`} />
        ) : (
          r.rank
        )}
      </span>
      {type === 'clans' ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brass/10 text-xs font-bold text-brass ring-1 ring-brass/30">
          {r.tag}
        </span>
      ) : (
        <Avatar name={r.name} size={36} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">
          {r.name}
          {r.isMe && <span className="ml-2 text-xs text-brass">({t('rankings.you')})</span>}
        </span>
        {type !== 'clans' && r.tag && <Badge className="mt-0.5">{r.tag}</Badge>}
        {type !== 'clans' && r.level !== null && type !== 'level' && (
          <span className="ml-2 text-xs text-ink-faint">Level {r.level}</span>
        )}
      </span>
      <span
        className={cn(
          'num text-right font-semibold',
          type === 'wealth' || type === 'clans' ? 'text-neon' : 'text-ink',
        )}
      >
        {formatValue(type, r.value)}
      </span>
    </li>
  );
}

export function RankingsPage() {
  const { t } = useTranslation();
  const [type, setType] = useState<RankingType>('wealth');
  const r = useRanking(type);
  const meVisible = r.data?.rows.some((x) => x.isMe);

  return (
    <div>
      <PageHeader title={t('rankings.title')} subtitle={t('rankings.subtitle')} />
      <Tabs
        className="mb-5"
        value={type}
        onChange={setType}
        items={(['wealth', 'reputation', 'level', 'clans'] as const).map((v) => ({
          value: v,
          label: t(`rankings.${v}`),
        }))}
      />

      {r.isError && <ErrorState error={r.error} onRetry={() => r.refetch()} />}
      {r.isPending && <Skeleton className="h-96" />}
      {r.data && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Podium */}
          <div className="order-first grid grid-cols-3 items-end gap-3 lg:order-last lg:col-span-1 lg:self-start">
            {[1, 0, 2].map((i) => {
              const row = r.data.rows[i];
              if (!row) return <div key={i} />;
              return (
                <div key={row.id} className="flex flex-col items-center gap-2 text-center">
                  {type === 'clans' ? (
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brass/10 text-sm font-bold text-brass ring-1 ring-brass/30">
                      {row.tag}
                    </span>
                  ) : (
                    <Avatar name={row.name} size={i === 0 ? 56 : 44} />
                  )}
                  <span className="w-full truncate text-xs font-semibold text-ink">{row.name}</span>
                  <div
                    className={cn(
                      'panel grid w-full place-items-center rounded-b-none font-display text-2xl font-bold',
                      i === 0
                        ? 'h-28 text-[#ffd23f] shadow-glow'
                        : i === 1
                          ? 'h-20 text-[#c9d1d9]'
                          : 'h-14 text-[#cd7f32]',
                    )}
                  >
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="panel overflow-hidden lg:col-span-2">
            <ul className="divide-y divide-line/5">
              {r.data.rows.map((row) => (
                <Row key={row.id} r={row} type={type} />
              ))}
            </ul>
            {!meVisible && (
              <p className="border-t border-line/10 px-4 py-3 text-xs text-ink-faint">
                {t('rankings.notListed')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
