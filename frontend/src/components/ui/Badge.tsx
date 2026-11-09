import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'brass' | 'neon' | 'danger' | 'info' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-muted ring-line/15',
  brass: 'bg-brass/10 text-brass ring-brass/30',
  neon: 'bg-neon/10 text-neon ring-neon/30',
  danger: 'bg-danger/10 text-danger ring-danger/30',
  info: 'bg-info/10 text-info ring-info/30',
  warn: 'bg-warn/10 text-warn ring-warn/30',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
