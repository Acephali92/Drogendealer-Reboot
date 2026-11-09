import { useNavigate } from 'react-router-dom';
import { Lightbulb, MapPin, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCities, useSetStartCity } from '@/api/queries';
import { CityArt } from '@/components/ui/CityArt';
import { Skeleton, ErrorState } from '@/components/ui/Feedback';
import { Logo } from '@/components/layout/Logo';
import { toast } from '@/stores/toast';
import { errorMessage } from '@/lib/errors';
import { formatNumber } from '@/lib/money';

export function StartCityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cities = useCities();
  const choose = useSetStartCity();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Logo className="mb-10" />
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">{t('start.title')}</h1>
      <p className="mt-2 text-ink-muted">{t('start.subtitle')}</p>
      <div className="mt-5 flex gap-3 rounded-xl border border-brass/30 bg-brass/5 p-4 text-sm text-ink-muted">
        <Lightbulb className="h-5 w-5 shrink-0 text-brass" aria-hidden />
        <p>
          <strong className="text-brass">{t('start.tipLabel')}:</strong> {t('start.tip')}
        </p>
      </div>

      {cities.isError && <ErrorState error={cities.error} onRetry={() => cities.refetch()} />}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {cities.isPending && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[4/3]" />)}
        {cities.data?.map((c, i) => (
          <button
            key={c.id}
            disabled={choose.isPending}
            onClick={() =>
              choose.mutate(c.id, {
                onSuccess: () => {
                  toast.success(t('start.chosen', { city: c.name }));
                  navigate('/', { replace: true });
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
            style={{ animationDelay: `${i * 30}ms` }}
            className="group panel relative aspect-[4/3] animate-fade-up overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-glow disabled:opacity-60"
          >
            <CityArt slug={c.slug} className="absolute inset-0 transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="font-display text-lg font-bold text-ink">{c.name}</p>
              <p className="flex items-center gap-3 text-xs text-ink-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {c.country}
                </span>
                <span className="flex items-center gap-1" title={t('stats.police')}>
                  <Shield className="h-3 w-3" aria-hidden />
                  {c.policeStrength}
                </span>
                <span className="hidden sm:inline">{formatNumber(c.population)}</span>
              </p>
            </div>
            <span className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs font-semibold text-brass opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {t('start.choose')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
