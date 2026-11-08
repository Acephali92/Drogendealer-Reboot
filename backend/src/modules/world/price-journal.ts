import type { MarketPriceChangeCause, Prisma } from '@prisma/client';

/**
 * Sets cause and reference for every MarketPrice change made in the CURRENT transaction.
 * The DB trigger "MarketPrice_journal" writes them into the append-only MarketPriceChange journal.
 *
 * Must be called inside `prisma.$transaction(async (tx) => …)` before touching MarketPrice –
 * the settings are transaction-local (set_config(..., true)) and vanish on commit/rollback.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   await setPriceChangeContext(tx, 'TRADE', trade.id);
 *   await tx.marketPrice.update({ … });
 * });
 */
export async function setPriceChangeContext(
  tx: Prisma.TransactionClient,
  cause: MarketPriceChangeCause,
  refId?: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT set_config('app.price_change_cause', ${cause}, true),
           set_config('app.price_change_ref', ${refId ?? ''}, true)`;
}
