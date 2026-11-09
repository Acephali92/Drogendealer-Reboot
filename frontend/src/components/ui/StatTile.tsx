import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'neon' | 'brass' | 'danger';
  className?: string;
}

const toneCls = { default: 'text-ink', neon: 'text-neon', brass: 'text-brass', danger: 'text-danger' };

export function StatTile({ label, value, icon, hint, tone = 'default', className }: StatTileProps) {
  return (
    <div className={cn('panel p-4 animate-fade-up', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <div className={cn('num mt-2 truncate text-xl font-semibold sm:text-2xl', toneCls[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}
