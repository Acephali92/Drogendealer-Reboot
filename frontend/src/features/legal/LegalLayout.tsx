import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/layout/Logo';
import { Skeleton } from '@/components/ui/Feedback';
import { LegalLinks } from './LegalLinks';
import { useLegalConfig, type LegalConfig } from './legalConfig';

export function LegalLayout({ title, children }: { title: string; children: (c: LegalConfig) => ReactNode }) {
  const { t } = useTranslation();
  const q = useLegalConfig();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link to="/" aria-label={t('nav.dashboard')}>
          <Logo />
        </Link>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          {t('app.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-ink">{title}</h1>
      {q.data?.placeholder && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm text-ink-muted"
        >
          <TriangleAlert className="h-5 w-5 shrink-0 text-warn" aria-hidden />
          <p>{t('legal.placeholder')}</p>
        </div>
      )}
      <article className="legal mt-8 space-y-6 text-sm leading-relaxed text-ink-muted">
        {q.data ? children(q.data.config) : <Skeleton className="h-64" />}
      </article>
      <footer className="mt-12 border-t border-line/10 pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function Address({ c }: { c: LegalConfig }) {
  return (
    <address className="not-italic text-ink">
      {c.operatorName}
      <br />
      {c.street}
      <br />
      {c.postalCode} {c.city}
      {c.country && (
        <>
          <br />
          {c.country}
        </>
      )}
    </address>
  );
}
