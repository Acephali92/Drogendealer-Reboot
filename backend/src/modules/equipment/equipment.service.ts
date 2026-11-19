import type { PrismaClient } from '@prisma/client';
import type { GameParameters } from '../../domain/index.js';
import { serialize } from '../../lib/serialize.js';
import { equipmentTypeView } from '../catalog/catalog.js';

const rowSelect = { id: true, slug: true, slot: true } as const;

/** Weapons and armor from parameters.toml ([weapons.*], [armor.*]), weapons first, by price. */
export async function listEquipmentTypes(prisma: PrismaClient, params: GameParameters) {
  const rows = await prisma.equipmentType.findMany({ select: rowSelect });
  const equipmentTypes = rows
    .map((r) => equipmentTypeView(params, r))
    .sort((a, b) =>
      a.slot !== b.slot
        ? a.slot === 'WEAPON'
          ? -1
          : 1
        : a.price === b.price
          ? 0
          : a.price < b.price
            ? -1
            : 1,
    );
  return serialize({ equipmentTypes });
}

export async function listPlayerEquipment(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const equipment = await prisma.playerEquipment.findMany({
    where: { playerId },
    select: { id: true, equipped: true, acquiredAt: true, equipmentType: { select: rowSelect } },
    orderBy: [{ equipped: 'desc' }, { acquiredAt: 'asc' }],
  });
  return serialize({
    equipment: equipment.map((e) => ({ ...e, equipmentType: equipmentTypeView(params, e.equipmentType) })),
  });
}
