import type { PrismaClient } from '@prisma/client';
import type { GameParameters } from '../../domain/index.js';
import { serialize } from '../../lib/serialize.js';
import { vehicleTypeView } from '../catalog/catalog.js';

/** Vehicle catalog from parameters.toml, ordered by price. */
export async function listVehicleTypes(prisma: PrismaClient, params: GameParameters) {
  const rows = await prisma.vehicleType.findMany({ select: { id: true, slug: true } });
  const vehicleTypes = rows
    .map((r) => vehicleTypeView(params, r))
    .sort((a, b) => (a.price === b.price ? a.name.localeCompare(b.name) : a.price < b.price ? -1 : 1));
  return serialize({ vehicleTypes });
}

export async function listPlayerVehicles(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const vehicles = await prisma.vehicle.findMany({
    where: { playerId },
    select: {
      id: true,
      condition: true,
      isActive: true,
      purchasedAt: true,
      vehicleType: { select: { id: true, slug: true } },
    },
    orderBy: [{ isActive: 'desc' }, { purchasedAt: 'asc' }],
  });
  return serialize({
    vehicles: vehicles.map((v) => ({ ...v, vehicleType: vehicleTypeView(params, v.vehicleType) })),
  });
}
