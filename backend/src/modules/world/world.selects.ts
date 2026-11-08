import type { Prisma } from '@prisma/client';

export const citySummarySelect = { id: true, slug: true, name: true } as const satisfies Prisma.CitySelect;

export const citySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  country: true,
  techLevel: true,
  policeStrength: true,
  population: true,
} as const satisfies Prisma.CitySelect;

export const commoditySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  illegal: true,
  unitWeightG: true,
  basePrice: true,
} as const satisfies Prisma.CommoditySelect;
