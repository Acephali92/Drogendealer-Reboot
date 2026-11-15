import type { MarketChangeCause, Prisma } from '@prisma/client';

/**
 * Sets cause, reference and tick for every MarketState change made in the CURRENT transaction.
 * The DB trigger "MarketState_journal" writes them into the append-only MarketStateChange journal
 * (T-105, GAME_ECONOMY.md §7 T-2/T-6).
 *
 * Must be called inside `prisma.$transaction(async (tx) => …)` before touching MarketState –
 * the settings are transaction-local (set_config(..., true)) and vanish on commit/rollback.
 */
export async function setMarketChangeContext(
  tx: Prisma.TransactionClient,
  cause: MarketChangeCause,
  refId?: string,
  tick?: number,
): Promise<void> {
  if (tick !== undefined && (!Number.isSafeInteger(tick) || tick < 0)) {
    throw new RangeError(`invalid tick ${tick}`);
  }
  await tx.$queryRaw`
    SELECT set_config('app.market_change_cause', ${cause}, true),
           set_config('app.market_change_ref', ${refId ?? ''}, true),
           set_config('app.market_change_tick', ${tick === undefined ? '' : String(tick)}, true)`;
}
