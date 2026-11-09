import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  max: number;
  min?: number;
  label: string;
  className?: string;
}

const STEPS = [1, 10, 100, 1000];

export function NumberStepper({ value, onChange, max, min = 0, label, className }: NumberStepperProps) {
  const { t } = useTranslation();
  const clamp = (v: number) => Math.min(Math.max(min, Math.floor(v || 0)), Math.max(min, max));
  const step = STEPS.filter((s) => s * 20 <= Math.max(max, 1)).pop() ?? 1;
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="−"
          onClick={() => onChange(clamp(value - step))}
          className="grid w-11 place-items-center rounded-lg bg-surface-3 text-ink-muted ring-1 ring-line/15 hover:text-ink"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="num h-11 min-w-0 flex-1 rounded-lg bg-bg px-3 text-center text-lg text-ink ring-1 ring-line/20 focus:ring-brass/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="+"
          onClick={() => onChange(clamp(value + step))}
          className="grid w-11 place-items-center rounded-lg bg-surface-3 text-ink-muted ring-1 ring-line/15 hover:text-ink"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(clamp(max))}
          className="rounded-lg bg-brass/10 px-3 text-sm font-semibold text-brass ring-1 ring-brass/30 hover:bg-brass/20"
        >
          {t('trade.max')}
        </button>
      </div>
      <input
        type="range"
        aria-hidden
        tabIndex={-1}
        min={min}
        max={Math.max(min, max)}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-full accent-[rgb(var(--brass))]"
      />
    </div>
  );
}
