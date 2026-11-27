import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

/**
 * Journal context of the CURRENT transaction (TD-022, docs/database/REVIEW-v2.md G-1/G-2/G-6).
 *
 * Every journal row (MoneyTransaction, InventoryMovement, TradeTransaction, ClanTreasuryTransaction,
 * MarketStateChange) takes tick, correlationId and actor from this context via DB defaults and
 * triggers. Without it the database rejects the row (JOURNAL_CONTEXT_MISSING) – a forgotten call
 * fails loudly instead of writing untraceable history.
 *
 * Call once at the start of every writing transaction, inside
 * `prisma.$transaction(async (tx) => …)`: the settings are transaction-local (set_config(..., true))
 * and vanish on commit or rollback. One context = one business action: all rows of the action share
 * the correlationId.
 */
export type JournalActor =
  { readonly type: 'PLAYER'; readonly playerId: string } | { readonly type: 'SYSTEM' | 'NPC' | 'ADMIN' };

export interface JournalContext {
  readonly tick: number;
  readonly actor: JournalActor;
  /** Defaults to a new random UUID. */
  readonly correlationId?: string;
}

export async function setJournalContext(tx: Prisma.TransactionClient, ctx: JournalContext): Promise<string> {
  if (!Number.isSafeInteger(ctx.tick) || ctx.tick < 0) throw new RangeError(`invalid tick ${ctx.tick}`);
  const correlationId = ctx.correlationId ?? randomUUID();
  const playerId = ctx.actor.type === 'PLAYER' ? ctx.actor.playerId : null;
  await tx.$queryRaw`
    SELECT set_journal_context(${ctx.tick}::integer, ${correlationId}::uuid, ${ctx.actor.type}, ${playerId})::text`;
  return correlationId;
}

/**
 * The current world tick for journal rows. The only place that decides it: until the tick system
 * exists (T-104, WorldTick) every action belongs to tick 0 (world creation). T-104 replaces this
 * with the last started WorldTick.
 */
export function currentTick(): number {
  return 0;
}
