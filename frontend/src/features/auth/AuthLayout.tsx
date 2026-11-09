import type { ReactNode } from 'react';
import { Handshake, Route, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CityArt } from '@/components/ui/CityArt';
import { Logo } from '@/components/layout/Logo';
import { LegalLinks } from '@/features/legal/LegalLinks';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const features = [
    { icon: Handshake, text: t('auth.features.trade') },
    { icon: Route, text: t('auth.features.travel') },
    { icon: Users, text: t('auth.features.clans') },
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="noise relative hidden overflow-hidden lg:block">
        <CityArt slug="berlin" className="absolute inset-0 opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-bold leading-tight text-ink">{t('app.tagline')}</h2>
            <ul className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-ink-muted">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brass/10 text-brass ring-1 ring-brass/30">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="pt-1 text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold text-ink">{title}</h1>
          <p className="mb-8 mt-2 text-sm text-ink-muted">{subtitle}</p>
          {children}
          <p className="mt-10 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-ink-muted">
            <strong className="text-danger">{t('auth.ageNotice')}:</strong> {t('auth.ageNoticeText')}
          </p>
          <LegalLinks className="mt-4 justify-center" />
        </div>
      </div>
    </div>
  );
}
