import type { PrismaClient } from '@prisma/client';
import { withImage, type GameParameters } from '../../domain/index.js';
import { citySummarySelect } from '../world/world.selects.js';

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
      fromCity: { select: citySummarySelect },
      toCity: { select: citySummarySelect },
      vehicle: { select: { id: true, vehicleType: { select: { slug: true, name: true } } } },
    },
  });
  if (!travel) return { travel: null };
  const vehicle = travel.vehicle
    ? { ...travel.vehicle, vehicleType: withImage(params, 'vehicles', travel.vehicle.vehicleType) }
    : null;
  return { travel: { ...travel, vehicle } };
}
