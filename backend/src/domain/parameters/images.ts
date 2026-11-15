/**
 * Image lookup (ADR-020): images are assigned only in parameters.toml, never stored in the DB.
 * The DB slug of a commodity / vehicle type / equipment type is the technical key in the
 * matching parameters section (e.g. Commodity.slug "gras" ↔ [goods.gras]).
 */
import { IMAGE_CATEGORIES, type GameParameters, type ImageCategory } from './schema.js';

/** Equipment slot (DB enum EquipmentSlot) → image category. */
export const EQUIPMENT_SLOT_IMAGE_CATEGORY = { WEAPON: 'weapons', ARMOR: 'armor' } as const satisfies Record<
  string,
  ImageCategory
>;

/** Relative image path of a catalog entry, or null if the entry or its image is not defined. */
export function imageFor(params: GameParameters, category: ImageCategory, key: string): string | null {
  const section = params[category] as Readonly<Record<string, { image?: string | undefined }>>;
  if (!Object.prototype.hasOwnProperty.call(section, key)) return null;
  return section[key]?.image ?? null;
}

/** Fallback image per category from [images.fallback] (null where none is configured). */
export function imageFallbacks(params: GameParameters): Record<ImageCategory, string | null> {
  return Object.fromEntries(
    IMAGE_CATEGORIES.map((category) => [category, params.images?.fallback[category] ?? null]),
  ) as Record<ImageCategory, string | null>;
}

/** Adds `image` to an object that carries the technical key as `slug`. */
export function withImage<T extends { slug: string }>(
  params: GameParameters,
  category: ImageCategory,
  entry: T,
): T & { image: string | null } {
  return { ...entry, image: imageFor(params, category, entry.slug) };
}
