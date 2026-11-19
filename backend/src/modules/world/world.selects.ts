import type { Prisma } from '@prisma/client';

/** Catalog rows only carry id + technical key; values come from parameters.toml (catalog.ts). */
export const catalogRowSelect = { id: true, slug: true } as const satisfies Prisma.CitySelect &
  Prisma.CommoditySelect;
