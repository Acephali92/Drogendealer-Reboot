import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { useToasts, type ToastTone } from '@/stores/toast';
import { cn } from '@/lib/cn';

const icons: Record<ToastTone, JSX.Element> = {
  success: <CheckCircle2 className="h-5 w-5 text-neon" />,
  error: <XCircle className="h-5 w-5 text-danger" />,
  info: <Info className="h-5 w-5 text-info" />,
  warn: <TriangleAlert className="h-5 w-5 text-warn" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'panel pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 p-3 text-left',
            t.tone === 'success' && 'ring-1 ring-neon/30',
            t.tone === 'error' && 'ring-1 ring-danger/30',
          )}
        >
          {icons[t.tone]}
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{t.title}</span>
            {t.body && <span className="block text-xs text-ink-muted">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
