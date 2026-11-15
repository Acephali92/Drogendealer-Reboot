import type { Prisma, PrismaClient } from '@prisma/client';
import { withImage, type GameParameters } from '../../domain/index.js';
import { serialize } from '../../lib/serialize.js';

export const vehicleTypeSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  capacityG: true,
  speedKmh: true,
  licenseClass: true,
} as const satisfies Prisma.VehicleTypeSelect;

export async function listVehicleTypes(prisma: PrismaClient, params: GameParameters) {
  const vehicleTypes = await prisma.vehicleType.findMany({
    select: vehicleTypeSelect,
    orderBy: [{ price: 'asc' }, { name: 'asc' }],
  });
  return serialize({ vehicleTypes: vehicleTypes.map((t) => withImage(params, 'vehicles', t)) });
}

export async function listPlayerVehicles(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const vehicles = await prisma.vehicle.findMany({
    where: { playerId },
    select: {
      id: true,
      condition: true,
      isActive: true,
      purchasedAt: true,
      vehicleType: { select: vehicleTypeSelect },
    },
    orderBy: [{ isActive: 'desc' }, { purchasedAt: 'asc' }],
  });
  return serialize({
    vehicles: vehicles.map((v) => ({ ...v, vehicleType: withImage(params, 'vehicles', v.vehicleType) })),
  });
}
