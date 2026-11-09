import type { Prisma, PrismaClient } from '@prisma/client';
import { serialize } from '../../lib/serialize.js';

export const equipmentTypeSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  slot: true,
  attack: true,
  defense: true,
  weightG: true,
  price: true,
} as const satisfies Prisma.EquipmentTypeSelect;

export async function listEquipmentTypes(prisma: PrismaClient) {
  const equipmentTypes = await prisma.equipmentType.findMany({
    select: equipmentTypeSelect,
    orderBy: [{ slot: 'asc' }, { price: 'asc' }, { name: 'asc' }],
  });
  return serialize({ equipmentTypes });
}

export async function listPlayerEquipment(prisma: PrismaClient, playerId: string) {
  const equipment = await prisma.playerEquipment.findMany({
    where: { playerId },
    select: { id: true, equipped: true, acquiredAt: true, equipmentType: { select: equipmentTypeSelect } },
    orderBy: [{ equipped: 'desc' }, { acquiredAt: 'asc' }],
  });
  return serialize({ equipment });
}
