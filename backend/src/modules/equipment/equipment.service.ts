import type { Prisma, PrismaClient } from '@prisma/client';
import { EQUIPMENT_SLOT_IMAGE_CATEGORY, withImage, type GameParameters } from '../../domain/index.js';
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

type EquipmentTypeRow = Prisma.EquipmentTypeGetPayload<{ select: typeof equipmentTypeSelect }>;

/** Weapons look up their image in [weapons], armor in [armor] (ADR-020). */
const withEquipmentImage = (params: GameParameters, type: EquipmentTypeRow) =>
  withImage(params, EQUIPMENT_SLOT_IMAGE_CATEGORY[type.slot], type);

export async function listEquipmentTypes(prisma: PrismaClient, params: GameParameters) {
  const equipmentTypes = await prisma.equipmentType.findMany({
    select: equipmentTypeSelect,
    orderBy: [{ slot: 'asc' }, { price: 'asc' }, { name: 'asc' }],
  });
  return serialize({ equipmentTypes: equipmentTypes.map((t) => withEquipmentImage(params, t)) });
}

export async function listPlayerEquipment(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const equipment = await prisma.playerEquipment.findMany({
    where: { playerId },
    select: { id: true, equipped: true, acquiredAt: true, equipmentType: { select: equipmentTypeSelect } },
    orderBy: [{ equipped: 'desc' }, { acquiredAt: 'asc' }],
  });
  return serialize({
    equipment: equipment.map((e) => ({ ...e, equipmentType: withEquipmentImage(params, e.equipmentType) })),
  });
}
