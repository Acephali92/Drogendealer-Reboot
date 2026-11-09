import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/** Dialog; auf dem Handy als Bottom-Sheet. Esc schließt, Fokus bleibt im Dialog. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const focusable = ref.current?.querySelector<HTMLElement>(
      'input, [data-autofocus], button:not([aria-label])',
    );
    (focusable ?? ref.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-up"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'panel relative w-full animate-fade-up rounded-b-none bg-surface sm:rounded-xl',
          'max-h-[92dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]',
          size === 'sm' ? 'sm:max-w-sm' : size === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl',
        )}
      >
        <div className="panel-header sticky top-0 z-10 bg-surface/95 backdrop-blur">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:text-ink"
            aria-label={t('app.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line/10 p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
