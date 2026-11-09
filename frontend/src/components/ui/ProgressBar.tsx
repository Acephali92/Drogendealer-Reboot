import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number; // 0..1
  tone?: 'brass' | 'neon' | 'danger' | 'info' | 'auto';
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  className?: string;
}

const tones = { brass: 'bg-brass', neon: 'bg-neon', danger: 'bg-danger', info: 'bg-info' };

export function ProgressBar({ value, tone = 'brass', size = 'sm', label, className }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, value));
  const resolved = tone === 'auto' ? (v > 0.9 ? 'danger' : v > 0.7 ? 'brass' : 'neon') : tone;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[resolved])}
        style={{ width: `${v * 100}%`, boxShadow: `0 0 12px rgb(var(--${resolved === 'brass' ? 'brass' : resolved}) / 0.6)` }}
      />
    </div>
  );
}
