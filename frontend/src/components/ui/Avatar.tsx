import { cn } from '@/lib/cn';
import { hashHue } from '@/lib/art';

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const hue = hashHue(name);
  const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-xl font-display font-bold text-bg ring-1 ring-white/10', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 40) % 360} 70% 40%))`,
      }}
    >
      {initials}
    </span>
  );
}
