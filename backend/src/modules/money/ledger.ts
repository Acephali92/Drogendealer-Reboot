/**
 * The only way money moves (ADR-010): every change of Player.cash / Player.bank is booked in the
 * append-only MoneyTransaction journal in the same transaction, so that
 *   Σ amount per (player, account) = projection   (docs/database/DATA_MODEL.md, invariant M-1)
 * Must be called inside prisma.$transaction(async (tx) => …).
 */
import type { MoneyAccount, MoneyTransactionReason, Prisma } from '@prisma/client';
import { AppError } from '../../lib/errors.js';

export interface MoneyBooking {
  playerId: string;
  account: MoneyAccount;
  /** Positive = credit, negative = debit (cents). Zero bookings are skipped. */
  amount: bigint;
  reason: MoneyTransactionReason;
  refId?: string;
}

/** Books one movement and returns the new balance of that account (or the old one for amount 0). */
export async function bookMoney(tx: Prisma.TransactionClient, booking: MoneyBooking): Promise<bigint> {
  const isCash = booking.account === 'CASH';
  if (booking.amount === 0n) {
    const current = await tx.player.findUniqueOrThrow({
      where: { id: booking.playerId },
      select: { cash: true, bank: true },
    });
    return isCash ? current.cash : current.bank;
  }

  // Conditional, atomic update: a debit only succeeds if the balance covers it. Safe against
  // concurrent bookings (no read-then-write race); the DB CHECK (>= 0) is the last line of defence.
  const coversDebit = booking.amount < 0n ? -booking.amount : 0n;
  const { count } = await tx.player.updateMany({
    where: isCash
      ? { id: booking.playerId, cash: { gte: coversDebit } }
      : { id: booking.playerId, bank: { gte: coversDebit } },
    data: isCash ? { cash: { increment: booking.amount } } : { bank: { increment: booking.amount } },
  });
  if (count !== 1) {
    throw new AppError(422, 'INSUFFICIENT_FUNDS', `Not enough money on ${booking.account.toLowerCase()}`);
  }
  const updated = await tx.player.findUniqueOrThrow({
    where: { id: booking.playerId },
    select: { cash: true, bank: true },
  });
  const balanceAfter = isCash ? updated.cash : updated.bank;

  await tx.moneyTransaction.create({
    data: {
      playerId: booking.playerId,
      account: booking.account,
      amount: booking.amount,
      balanceAfter,
      reason: booking.reason,
      refId: booking.refId,
    },
  });
  return balanceAfter;
}
