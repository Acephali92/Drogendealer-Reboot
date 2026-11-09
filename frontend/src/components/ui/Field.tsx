import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  icon?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, icon, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={fid} className="label block">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={fid}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${fid}-msg` : undefined}
          className={cn(
            'h-11 w-full rounded-lg bg-bg px-3 text-ink ring-1 ring-line/20 placeholder:text-ink-faint transition focus:outline-none focus:ring-2 focus:ring-brass/60',
            icon && 'pl-10',
            error && 'ring-danger/60',
          )}
          {...rest}
        />
      </div>
      {(error || hint) && (
        <p id={`${fid}-msg`} className={cn('text-xs', error ? 'text-danger' : 'text-ink-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
