import type { MarketChangeCause, Prisma } from '@prisma/client';

/** Formula intermediate values of a market change; required keys per cause, see DATA_MODELS.md. */
export type MarketChangeDetail = Readonly<Record<string, string | number | boolean | null>>;

export interface MarketChangeContext {
  readonly cause: MarketChangeCause;
  /** Reference to the trigger, e.g. the TradeTransaction id (required for TRADE). */
  readonly refId?: string;
  /** Required keys per cause (DB CHECK): TICK, EVENT, NPC, TRADE – names as in verify.py. */
  readonly detail?: MarketChangeDetail;
}

/**
 * Sets cause, reference and formula details for every MarketState change made in the CURRENT
 * transaction. The DB trigger "MarketState_journal" writes them, together with tick and
 * correlationId from the journal context (setJournalContext, TD-022), into the append-only
 * MarketStateChange journal. Without a cause an UPDATE is rejected (fail-closed).
 *
 * Must be called inside `prisma.$transaction(async (tx) => …)` after setJournalContext and before
 * touching MarketState – the settings are transaction-local.
 */
export async function setMarketChangeContext(
  tx: Prisma.TransactionClient,
  ctx: MarketChangeContext,
): Promise<void> {
  const detail = ctx.detail === undefined ? '' : JSON.stringify(ctx.detail);
  await tx.$queryRaw`
    SELECT set_config('app.market_change_cause', ${ctx.cause}, true),
           set_config('app.market_change_ref', ${ctx.refId ?? ''}, true),
           set_config('app.market_change_detail', ${detail}, true)`;
}
