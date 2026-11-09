import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { imageFallbacks } from 'virtual:game-images';
import { imageCandidates } from '@/lib/imagePath';
import { cn } from '@/lib/cn';

export type ImageCategory = keyof typeof imageFallbacks;

interface GameImageProps {
  /** Pfad relativ zu images/ (aus parameters.toml bzw. API-Feld `image`) */
  image: string | null | undefined;
  category: ImageCategory;
  /** Anzeigename – wird als alt-Text genutzt, nie der Schlüssel (ADR-013, T-112) */
  name: string;
  /** Eingebautes neutrales Symbol, falls weder Bild noch Kategorie-Platzhalter laden */
  fallback: ReactNode;
  size?: number;
  className?: string;
}

/**
 * Zentrale Bildkomponente (ADR-020, T-115).
 * Fallback-Kette: Bild → Kategorie-Platzhalter aus [images] → eingebautes Symbol.
 * Jeder Fehler rückt genau einen Schritt weiter; keine Endlosschleife bei onError.
 * Festes quadratisches Format (kein Layout-Springen), lazy geladen.
 */
export function GameImage({ image, category, name, fallback, size = 44, className }: GameImageProps) {
  const candidates = useMemo(
    () => imageCandidates(import.meta.env.BASE_URL, image, imageFallbacks[category]),
    [image, category],
  );
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [candidates]);
  const src = candidates[step];

  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl', className)}
      style={{ width: size, height: size }}
      data-image-step={src ? step : 'icon'}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setStep((s) => s + 1)}
          className="h-full w-full object-contain"
        />
      ) : (
        fallback
      )}
    </span>
  );
}
