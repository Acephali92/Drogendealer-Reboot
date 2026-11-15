import type { PrismaClient } from '@prisma/client';
import { withImage, type GameParameters } from '../../domain/index.js';
import { serialize } from '../../lib/serialize.js';
import { commoditySelect } from '../world/world.selects.js';

/**
 * Carried goods plus transport capacity.
 * capacityG comes from the active vehicle (null without one); usedG counts commodities only.
 * Whether equipment weight or a base carry capacity count is a game-design decision.
 */
export async function getInventory(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const [items, activeVehicle] = await prisma.$transaction([
    prisma.inventoryItem.findMany({
      where: { playerId, quantity: { gt: 0 } },
      select: { quantity: true, avgBuyPrice: true, commodity: { select: commoditySelect } },
      orderBy: { commodity: { name: 'asc' } },
    }),
    prisma.vehicle.findFirst({
      where: { playerId, isActive: true },
      select: { vehicleType: { select: { capacityG: true } } },
    }),
  ]);

  const usedG = items.reduce((sum, i) => sum + i.quantity * i.commodity.unitWeightG, 0);
  return serialize({
    items: items.map((i) => ({ ...i, commodity: withImage(params, 'goods', i.commodity) })),
    capacityG: activeVehicle?.vehicleType.capacityG ?? null,
    usedG,
  });
}
