import type { PrismaClient } from '@prisma/client';
import { citySummarySelect } from '../world/world.selects.js';

/**
 * The player's travel in progress, or null.
 * Note: arrival is not resolved here yet (that belongs to the travel logic), so a travel
 * whose arrivesAt lies in the past is still returned with status IN_PROGRESS.
 */
export async function getCurrentTravel(prisma: PrismaClient, playerId: string) {
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
  return { travel };
}
