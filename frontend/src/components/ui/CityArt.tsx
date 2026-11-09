import { memo, useMemo } from 'react';
import { hashHue, seededRandom } from '@/lib/art';
import { cn } from '@/lib/cn';

/**
 * Generierte Nacht-Skyline pro Stadt (statt Fotos: keine Bildrechte, kleine Datenmenge,
 * einheitlicher Look). Später durch eigene Illustrationen ersetzbar.
 */
export const CityArt = memo(function CityArt({ slug, className }: { slug: string; className?: string }) {
  const art = useMemo(() => {
    const rnd = seededRandom(slug);
    const hue = hashHue(slug);
    const far: { x: number; w: number; h: number }[] = [];
    const near: { x: number; w: number; h: number; roof: number }[] = [];
    const windows: { x: number; y: number; o: number }[] = [];
    for (let x = -10; x < 400; ) {
      const w = 18 + rnd() * 34;
      far.push({ x, w, h: 40 + rnd() * 70 });
      x += w + rnd() * 6;
    }
    for (let x = -6; x < 400; ) {
      const w = 22 + rnd() * 40;
      const h = 30 + rnd() * 85;
      const roof = rnd();
      near.push({ x, w, h, roof });
      for (let wy = 200 - h + 8; wy < 192; wy += 9) {
        for (let wx = x + 4; wx < x + w - 6; wx += 8) {
          if (rnd() < 0.22) windows.push({ x: wx, y: wy, o: 0.4 + rnd() * 0.6 });
        }
      }
      x += w + 2 + rnd() * 5;
    }
    return { hue, far, near, windows, moonX: 60 + rnd() * 280, moonY: 26 + rnd() * 30 };
  }, [slug]);

  const id = `c-${slug}`;
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      className={cn('block h-full w-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${art.hue} 55% 10%)`} />
          <stop offset="0.65" stopColor={`hsl(${(art.hue + 25) % 360} 60% 22%)`} />
          <stop offset="1" stopColor="hsl(30 90% 40%)" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-moon`}>
          <stop offset="0" stopColor="#fff4d6" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#ffd38a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id}-sky)`} />
      <circle cx={art.moonX} cy={art.moonY} r="38" fill={`url(#${id}-moon)`} />
      <circle cx={art.moonX} cy={art.moonY} r="7" fill="#fff4d6" opacity="0.9" />
      <g fill={`hsl(${art.hue} 35% 14%)`}>
        {art.far.map((b, i) => (
          <rect key={i} x={b.x} y={200 - b.h - 20} width={b.w} height={b.h + 20} />
        ))}
      </g>
      <g fill="#07060a">
        {art.near.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={200 - b.h} width={b.w} height={b.h} />
            {b.roof > 0.75 && <rect x={b.x + b.w / 2 - 1} y={200 - b.h - 14} width="2" height="14" />}
            {b.roof > 0.55 && b.roof <= 0.75 && (
              <polygon
                points={`${b.x},${200 - b.h} ${b.x + b.w / 2},${200 - b.h - 12} ${b.x + b.w},${200 - b.h}`}
              />
            )}
          </g>
        ))}
      </g>
      <g fill="#ffcf6e">
        {art.windows.map((w, i) => (
          <rect key={i} x={w.x} y={w.y} width="3" height="4" opacity={w.o} />
        ))}
      </g>
    </svg>
  );
});
