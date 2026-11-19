import type { PrismaClient } from '@prisma/client';
import type { GameParameters } from '../../domain/index.js';
import { serialize } from '../../lib/serialize.js';
import { commodityView } from '../catalog/catalog.js';

/**
 * Carried goods plus cargo space in volume units (T-119):
 *   capacity = player.backpack_capacity + capacity of the active vehicle
 *   used     = Σ quantity × goods.<id>.volume
 * Goods are stored as lots per purchase (InventoryLot); avgBuyPrice = Σ costBasis / Σ quantity
 * (rounded down).
 */
export async function getInventory(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const [lots, activeVehicle] = await prisma.$transaction([
    prisma.inventoryLot.findMany({
      where: { playerId, quantity: { gt: 0 } },
      select: { quantity: true, costBasis: true, commodity: { select: { id: true, slug: true } } },
    }),
    prisma.vehicle.findFirst({
      where: { playerId, isActive: true },
      select: { vehicleType: { select: { slug: true } } },
    }),
  ]);

  const byGood = new Map<
    string,
    { commodity: { id: string; slug: string }; quantity: number; cost: bigint }
  >();
  for (const lot of lots) {
    const entry = byGood.get(lot.commodity.slug) ?? { commodity: lot.commodity, quantity: 0, cost: 0n };
    entry.quantity += lot.quantity;
    entry.cost += lot.costBasis;
    byGood.set(lot.commodity.slug, entry);
  }

  const items = [...byGood.values()]
    .map(({ commodity, quantity, cost }) => ({
      commodity: commodityView(params, commodity),
      quantity,
      avgBuyPrice: cost / BigInt(quantity),
    }))
    .sort((a, b) => a.commodity.name.localeCompare(b.commodity.name));

  const vehicleCapacity = activeVehicle
    ? (params.vehicles[activeVehicle.vehicleType.slug]?.capacity ?? 0)
    : 0;
  const used = items.reduce((sum, i) => sum + i.quantity * i.commodity.unitVolume, 0);

  return serialize({ items, capacity: params.player.backpack_capacity + vehicleCapacity, used });
}
