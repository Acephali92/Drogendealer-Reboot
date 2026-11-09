import { formatCountdown } from '@/lib/time';
import { useCountdown } from '@/lib/useCountdown';

export function Countdown({ to, onDone, className }: { to: string; onDone?: () => void; className?: string }) {
  const left = useCountdown(to, onDone);
  return (
    <time className={className ?? 'num'} dateTime={to} aria-live="off">
      {formatCountdown(left)}
    </time>
  );
}
