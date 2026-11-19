import type { PrismaClient } from '@prisma/client';
import type { GameParameters } from '../../domain/index.js';
import { serialize } from '../../lib/serialize.js';
import { citySummaryView, vehicleTypeView } from '../catalog/catalog.js';

const row = { select: { id: true, slug: true } } as const;

/**
 * The player's travel in progress, or null.
 * Note: arrival is not resolved here yet (that belongs to the travel logic), so a travel
 * whose arrivesAt lies in the past is still returned with status IN_PROGRESS.
 */
export async function getCurrentTravel(prisma: PrismaClient, params: GameParameters, playerId: string) {
  const travel = await prisma.travel.findFirst({
    where: { playerId, status: 'IN_PROGRESS' },
    orderBy: { departedAt: 'desc' },
    select: {
      id: true,
      status: true,
      departedAt: true,
      arrivesAt: true,
      fromCity: row,
      toCity: row,
      vehicle: { select: { id: true, vehicleType: row } },
    },
  });
  if (!travel) return { travel: null };
  return serialize({
    travel: {
      ...travel,
      fromCity: citySummaryView(params, travel.fromCity),
      toCity: citySummaryView(params, travel.toCity),
      vehicle: travel.vehicle
        ? { id: travel.vehicle.id, vehicleType: vehicleTypeView(params, travel.vehicle.vehicleType) }
        : null,
    },
  });
}
