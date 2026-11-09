import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-3/70', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brass', className)} aria-label="…" />;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-10 text-center', className)}>
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-3 text-brass">{icon}</div>
      )}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<AlertTriangle className="h-6 w-6 text-danger" />}
      title={errorMessage(error)}
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            {t('app.retry')}
          </Button>
        )
      }
    />
  );
}
