import {
  Cookie,
  Gem,
  Leaf,
  Moon,
  Package,
  Pill,
  Snowflake,
  Sparkles,
  Stamp,
  Syringe,
  Wind,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { hashHue } from '@/lib/art';
import { cn } from '@/lib/cn';

/** Symbol je Warenschlüssel (parameters.toml goods.*); Schlüssel werden nie angezeigt (T-112). */
const ICONS: Record<string, LucideIcon> = {
  gras: Leaf,
  haschisch: Cookie,
  pilze: Sparkles,
  speed: Zap,
  ecstasy: Pill,
  lsd: Stamp,
  kokain: Snowflake,
  heroin: Syringe,
  crack: Gem,
  sternenstaub: Wind,
  mondkristall: Moon,
};

export function CommodityIcon({
  slug,
  size = 44,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[slug] ?? Package;
  const hue = hashHue(slug);
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-white/10',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 70% 45% / 0.55), hsl(${hue} 40% 12%) 70%)`,
      }}
    >
      <Icon
        style={{ width: size * 0.5, height: size * 0.5, color: `hsl(${hue} 90% 78%)` }}
        strokeWidth={1.75}
      />
    </span>
  );
}
