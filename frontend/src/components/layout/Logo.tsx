import { cn } from '@/lib/cn';

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#1b140c" stroke="rgb(255 181 71 / .35)" />
        <path d="M9 8h7.5a8 8 0 0 1 0 16H9z" fill="none" stroke="#ffb547" strokeWidth="2.6" />
        <circle cx="23" cy="24" r="2.4" fill="#3dff9a" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-bold tracking-tight text-ink">
            Drogen<span className="text-brass">dealer</span>
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-faint">Reboot</span>
        </span>
      )}
    </span>
  );
}
