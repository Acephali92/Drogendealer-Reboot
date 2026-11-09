import type { Prisma, PrismaClient } from '@prisma/client';
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

export async function listVehicleTypes(prisma: PrismaClient) {
  const vehicleTypes = await prisma.vehicleType.findMany({
    select: vehicleTypeSelect,
    orderBy: [{ price: 'asc' }, { name: 'asc' }],
  });
  return serialize({ vehicleTypes });
}

export async function listPlayerVehicles(prisma: PrismaClient, playerId: string) {
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
  return serialize({ vehicles });
}
