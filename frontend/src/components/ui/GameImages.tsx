import { Crosshair, Shield } from 'lucide-react';
import type { Commodity, EquipmentType, VehicleType } from '@/api/types';
import { VehicleArt } from '@/features/vehicles/VehicleArt';
import { CommodityIcon } from './CommodityIcon';
import { GameImage } from './GameImage';

/** Ware: Bild aus parameters.toml → Platzhalter goods → eingebautes Symbol. */
export function CommodityImage({
  commodity,
  size = 44,
  className,
}: {
  commodity: Commodity;
  size?: number;
  className?: string;
}) {
  return (
    <GameImage
      image={commodity.image}
      category="goods"
      name={commodity.name}
      size={size}
      className={className}
      fallback={<CommodityIcon slug={commodity.slug} size={size} />}
    />
  );
}

/** Fahrzeug: Bild → Platzhalter vehicles → generierte Silhouette. */
export function VehicleImage({
  type,
  size = 96,
  className,
}: {
  type: VehicleType;
  size?: number;
  className?: string;
}) {
  return (
    <GameImage
      image={type.image}
      category="vehicles"
      name={type.name}
      size={size}
      className={className}
      fallback={<VehicleArt slug={type.slug} className="h-full w-full" />}
    />
  );
}

/** Waffe/Schutz: Bild → Platzhalter weapons/armor → Symbol. */
export function EquipmentImage({
  type,
  size = 64,
  className,
}: {
  type: EquipmentType;
  size?: number;
  className?: string;
}) {
  const weapon = type.slot === 'WEAPON';
  return (
    <GameImage
      image={type.image}
      category={weapon ? 'weapons' : 'armor'}
      name={type.name}
      size={size}
      className={className}
      fallback={
        <span className="grid h-full w-full place-items-center rounded-xl bg-surface-3 text-brass ring-1 ring-line/10">
          {weapon ? (
            <Crosshair style={{ width: size * 0.45, height: size * 0.45 }} />
          ) : (
            <Shield style={{ width: size * 0.45, height: size * 0.45 }} />
          )}
        </span>
      }
    />
  );
}
