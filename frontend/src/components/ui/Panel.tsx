import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PanelProps {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}

export function Panel({ title, icon, actions, children, className, bodyClassName, padded = true }: PanelProps) {
  return (
    <section className={cn('panel overflow-hidden animate-fade-up', className)}>
      {(title || actions) && (
        <header className="panel-header">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-brass">
            {icon && <span className="shrink-0 text-brass/80">{icon}</span>}
            <span className="truncate">{title}</span>
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
