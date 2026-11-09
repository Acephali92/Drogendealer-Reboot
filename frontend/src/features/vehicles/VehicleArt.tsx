import { hashHue } from '@/lib/art';

/** Stilisierte Fahrzeug-Silhouette je Typ (keine Fremdgrafiken). */
export function VehicleArt({ slug, className }: { slug: string; className?: string }) {
  const hue = hashHue(slug);
  const body = `hsl(${hue} 30% 55%)`;
  const shapes: Record<string, JSX.Element> = {
    motorroller: (
      <g>
        <path d="M34 54 H96 Q104 54 108 46 L114 20" fill="none" stroke={body} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 56 Q30 42 46 42 H78 Q84 42 84 50 V56 Z" fill={body} />
        <rect x="44" y="34" width="30" height="7" rx="3.5" fill={body} />
        <path d="M108 20 H122" stroke={body} strokeWidth="5" strokeLinecap="round" />
        <circle cx="40" cy="62" r="9" />
        <circle cx="114" cy="62" r="9" />
      </g>
    ),
    lkw: (
      <g>
        <rect x="8" y="18" width="98" height="40" rx="3" fill={body} />
        <path d="M108 30 H130 L144 44 V58 H108 Z" fill={body} />
        <rect x="116" y="34" width="14" height="10" rx="2" fill="#0b0907" opacity=".6" />
        {[26, 46, 92, 126].map((x) => (
          <circle key={x} cx={x} cy="62" r="8" />
        ))}
      </g>
    ),
    transporter: (
      <g>
        <path d="M14 58 V26 Q14 20 20 20 H104 L128 38 Q140 40 140 50 V58 Z" fill={body} />
        <rect x="106" y="25" width="16" height="12" rx="2" fill="#0b0907" opacity=".55" />
        <circle cx="42" cy="60" r="9" />
        <circle cx="114" cy="60" r="9" />
      </g>
    ),
    sportwagen: (
      <g>
        <path d="M8 56 Q10 44 30 42 L60 30 Q78 26 98 32 L130 42 Q146 46 146 56 Z" fill={body} />
        <path d="M64 33 L94 33 L110 42 L56 42 Z" fill="#0b0907" opacity=".55" />
        <circle cx="38" cy="58" r="9" />
        <circle cx="118" cy="58" r="9" />
      </g>
    ),
  };
  const car = (
    <g>
      <path d="M10 56 V44 Q10 38 18 37 L40 34 L58 20 H100 L120 34 L138 37 Q146 39 146 46 V56 Z" fill={body} />
      <path d="M62 24 H96 L112 34 H48 Z" fill="#0b0907" opacity=".55" />
      <circle cx="40" cy="58" r="9" />
      <circle cx="118" cy="58" r="9" />
    </g>
  );
  return (
    <svg viewBox="0 0 154 76" className={className} aria-hidden fill="#0b0907" stroke="none">
      <ellipse cx="78" cy="70" rx="66" ry="4" fill="#000" opacity=".5" />
      {shapes[slug] ?? car}
    </svg>
  );
}
