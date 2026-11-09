import { cn } from '@/lib/cn';

interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
  className?: string;
  label?: string;
}

/** Segmentierte Auswahl (Tastatur: Pfeiltasten). */
export function Tabs<T extends string>({ value, onChange, items, className, label }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 ring-1 ring-line/10', className)}
      onKeyDown={(e) => {
        const i = items.findIndex((x) => x.value === value);
        if (e.key === 'ArrowRight') onChange(items[(i + 1) % items.length]!.value);
        if (e.key === 'ArrowLeft') onChange(items[(i - 1 + items.length) % items.length]!.value);
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-surface-3 text-brass shadow-glow' : 'text-ink-muted hover:text-ink',
            )}
          >
            {it.label}
            {it.count !== undefined && it.count > 0 && (
              <span className="num rounded-full bg-brass/20 px-1.5 text-[11px] text-brass">{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
