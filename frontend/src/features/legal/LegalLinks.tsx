import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export function LegalLinks({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('legal.nav')}
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint', className)}
    >
      <span className="rounded border border-danger/40 px-1.5 py-0.5 font-semibold text-danger">18+</span>
      <Link to="/impressum" className="hover:text-ink">
        {t('legal.imprint')}
      </Link>
      <Link to="/datenschutz" className="hover:text-ink">
        {t('legal.privacy')}
      </Link>
    </nav>
  );
}
