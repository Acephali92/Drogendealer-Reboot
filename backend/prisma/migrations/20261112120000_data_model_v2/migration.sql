-- Data model v2 (ADR-022, T-005): catalog values only in parameters.toml, market state with
-- float stock/noise/event (B-14), heat per player and city (B-11), inventory lots + movement
-- journal (C-6), money account CASH/BANK (ADR-023), append-only journals with Restrict FKs
-- (ADR-010/017), clan treasury journal (ADR-018 groundwork).
-- Generated with `prisma migrate diff` and reviewed by hand (TD-005).

-- CreateEnum
CREATE TYPE "MarketChangeCause" AS ENUM ('INITIAL', 'TRADE', 'TICK', 'EVENT', 'NPC', 'ADMIN', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "MoneyAccount" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "InventoryMovementReason" AS ENUM ('TRADE_BUY', 'TRADE_SELL', 'SPOILAGE', 'CONFISCATION', 'LOOT_GAINED', 'LOOT_LOST', 'PRODUCTION', 'ACCOUNT_DELETION', 'ADMIN');

-- CreateEnum
CREATE TYPE "ClanTreasuryReason" AS ENUM ('DEPOSIT', 'PAYOUT', 'TAX', 'UPGRADE', 'DISTRICT', 'WAR', 'DISSOLUTION', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "MoneyTransactionReason_new" AS ENUM ('START_CAPITAL', 'TRADE_BUY', 'TRADE_SELL', 'TRAVEL_FUEL', 'TRAVEL_TICKET', 'BRIBE', 'CONFISCATION', 'VEHICLE_BUY', 'VEHICLE_SALE', 'EQUIPMENT_BUY', 'EQUIPMENT_SALE', 'CREW', 'LOOT_GAINED', 'LOOT_LOST', 'LAUNDERING', 'BUSINESS_INCOME', 'BUSINESS_UPKEEP', 'CLAN_DEPOSIT', 'CLAN_PAYOUT', 'CLAN_TAX', 'EMERGENCY_LOAN', 'LOAN_REPAYMENT', 'ACCOUNT_DELETION', 'ADMIN');
ALTER TABLE "MoneyTransaction" ALTER COLUMN "reason" TYPE "MoneyTransactionReason_new" USING ('ADMIN'::"MoneyTransactionReason_new"); -- old reasons have no 1:1 meaning; no rows exist yet
ALTER TYPE "MoneyTransactionReason" RENAME TO "MoneyTransactionReason_old";
ALTER TYPE "MoneyTransactionReason_new" RENAME TO "MoneyTransactionReason";
DROP TYPE "public"."MoneyTransactionReason_old";
COMMIT;

-- AlterEnum
ALTER TYPE "PlayerStatus" ADD VALUE 'DELETED';

-- DropForeignKey
ALTER TABLE "CityConnection" DROP CONSTRAINT "CityConnection_fromCityId_fkey";

-- DropForeignKey
ALTER TABLE "CityConnection" DROP CONSTRAINT "CityConnection_toCityId_fkey";

-- DropForeignKey
ALTER TABLE "Combat" DROP CONSTRAINT "Combat_attackerId_fkey";

-- DropForeignKey
ALTER TABLE "Combat" DROP CONSTRAINT "Combat_defenderId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_commodityId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_playerId_fkey";

-- DropForeignKey
ALTER TABLE "MarketPrice" DROP CONSTRAINT "MarketPrice_cityId_fkey";

-- DropForeignKey
ALTER TABLE "MarketPrice" DROP CONSTRAINT "MarketPrice_commodityId_fkey";

-- DropForeignKey
ALTER TABLE "MarketPriceChange" DROP CONSTRAINT "MarketPriceChange_cityId_fkey";

-- DropForeignKey
ALTER TABLE "MarketPriceChange" DROP CONSTRAINT "MarketPriceChange_commodityId_fkey";

-- DropForeignKey
ALTER TABLE "MoneyTransaction" DROP CONSTRAINT "MoneyTransaction_playerId_fkey";

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_userId_fkey";

-- DropForeignKey
ALTER TABLE "TradeTransaction" DROP CONSTRAINT "TradeTransaction_playerId_fkey";

-- DropForeignKey
ALTER TABLE "Travel" DROP CONSTRAINT "Travel_playerId_fkey";

-- AlterTable
ALTER TABLE "City" DROP COLUMN "country",
DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "policeStrength",
DROP COLUMN "population",
DROP COLUMN "techLevel";

-- AlterTable
-- Clan.bank keeps its value as the cash treasury (renamed, no data loss).
ALTER TABLE "Clan" RENAME COLUMN "bank" TO "treasuryCash";
ALTER TABLE "Clan" RENAME CONSTRAINT "Clan_bank_nonnegative" TO "Clan_treasuryCash_nonnegative";
ALTER TABLE "Clan" ADD COLUMN "dissolvedAt" TIMESTAMP(3),
ADD COLUMN     "treasuryBank" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Commodity" DROP COLUMN "basePrice",
DROP COLUMN "description",
DROP COLUMN "illegal",
DROP COLUMN "maxPrice",
DROP COLUMN "minPrice",
DROP COLUMN "name",
DROP COLUMN "unitWeightG";

-- AlterTable
ALTER TABLE "EquipmentType" DROP COLUMN "attack",
DROP COLUMN "defense",
DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "price",
DROP COLUMN "weightG";

-- AlterTable
-- Existing rows (if any) were cash movements.
ALTER TABLE "MoneyTransaction" ADD COLUMN "account" "MoneyAccount" NOT NULL DEFAULT 'CASH';
ALTER TABLE "MoneyTransaction" ALTER COLUMN "account" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "heat",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VehicleType" DROP COLUMN "capacityG",
DROP COLUMN "licenseClass",
DROP COLUMN "name",
DROP COLUMN "price",
DROP COLUMN "speedKmh";

-- DropTable
DROP TABLE "CityConnection";

-- DropTable
DROP TABLE "InventoryItem";

-- DropTable
DROP TABLE "MarketPrice";

-- DropTable
DROP TABLE "MarketPriceChange";

-- DropEnum
DROP TYPE "MarketPriceChangeCause";

-- Trigger functions of the old price journal (their triggers went with the tables).
DROP FUNCTION "market_price_journal"();
DROP FUNCTION "market_price_change_append_only"();

-- CreateTable
CREATE TABLE "PlayerCityHeat" (
    "playerId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "heat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCityHeat_pkey" PRIMARY KEY ("playerId","cityId")
);

-- CreateTable
CREATE TABLE "MarketState" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "stock" DOUBLE PRECISION NOT NULL,
    "noise" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeEvent" TEXT,
    "eventTicksLeft" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketStateChange" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "oldStock" DOUBLE PRECISION,
    "newStock" DOUBLE PRECISION NOT NULL,
    "oldNoise" DOUBLE PRECISION,
    "newNoise" DOUBLE PRECISION NOT NULL,
    "oldEvent" TEXT,
    "newEvent" TEXT,
    "cause" "MarketChangeCause" NOT NULL,
    "refId" TEXT,
    "tick" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketStateChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costBasis" BIGINT NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" "InventoryMovementReason" NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanTreasuryTransaction" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "playerId" TEXT,
    "account" "MoneyAccount" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "reason" "ClanTreasuryReason" NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanTreasuryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerCityHeat_cityId_idx" ON "PlayerCityHeat"("cityId");

-- CreateIndex
CREATE INDEX "MarketState_commodityId_idx" ON "MarketState"("commodityId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketState_cityId_commodityId_key" ON "MarketState"("cityId", "commodityId");

-- CreateIndex
CREATE INDEX "MarketStateChange_cityId_commodityId_createdAt_idx" ON "MarketStateChange"("cityId", "commodityId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketStateChange_commodityId_createdAt_idx" ON "MarketStateChange"("commodityId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketStateChange_cause_createdAt_idx" ON "MarketStateChange"("cause", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryLot_playerId_commodityId_idx" ON "InventoryLot"("playerId", "commodityId");

-- CreateIndex
CREATE INDEX "InventoryLot_commodityId_idx" ON "InventoryLot"("commodityId");

-- CreateIndex
CREATE INDEX "InventoryMovement_playerId_createdAt_idx" ON "InventoryMovement"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_playerId_commodityId_idx" ON "InventoryMovement"("playerId", "commodityId");

-- CreateIndex
CREATE INDEX "InventoryMovement_commodityId_idx" ON "InventoryMovement"("commodityId");

-- CreateIndex
CREATE INDEX "ClanTreasuryTransaction_clanId_createdAt_idx" ON "ClanTreasuryTransaction"("clanId", "createdAt");

-- CreateIndex
CREATE INDEX "ClanTreasuryTransaction_playerId_idx" ON "ClanTreasuryTransaction"("playerId");

-- CreateIndex
CREATE INDEX "MoneyTransaction_playerId_account_idx" ON "MoneyTransaction"("playerId", "account");

-- CreateIndex
CREATE INDEX "MoneyTransaction_reason_createdAt_idx" ON "MoneyTransaction"("reason", "createdAt");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCityHeat" ADD CONSTRAINT "PlayerCityHeat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCityHeat" ADD CONSTRAINT "PlayerCityHeat_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketState" ADD CONSTRAINT "MarketState_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketState" ADD CONSTRAINT "MarketState_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStateChange" ADD CONSTRAINT "MarketStateChange_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStateChange" ADD CONSTRAINT "MarketStateChange_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeTransaction" ADD CONSTRAINT "TradeTransaction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combat" ADD CONSTRAINT "Combat_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combat" ADD CONSTRAINT "Combat_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanTreasuryTransaction" ADD CONSTRAINT "ClanTreasuryTransaction_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanTreasuryTransaction" ADD CONSTRAINT "ClanTreasuryTransaction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────── Manual: integrity checks ───────────────────────────
ALTER TABLE "Clan" ADD CONSTRAINT "Clan_treasuryBank_nonnegative" CHECK ("treasuryBank" >= 0);
ALTER TABLE "MarketState" ADD CONSTRAINT "MarketState_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "MarketState" ADD CONSTRAINT "MarketState_eventTicksLeft_nonnegative" CHECK ("eventTicksLeft" >= 0);
ALTER TABLE "PlayerCityHeat" ADD CONSTRAINT "PlayerCityHeat_heat_nonnegative" CHECK ("heat" >= 0);
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_costBasis_nonnegative" CHECK ("costBasis" >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_delta_nonzero" CHECK ("delta" <> 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantityAfter_nonnegative" CHECK ("quantityAfter" >= 0);
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_amount_nonzero" CHECK ("amount" <> 0);
ALTER TABLE "ClanTreasuryTransaction" ADD CONSTRAINT "ClanTreasuryTransaction_amount_nonzero" CHECK ("amount" <> 0);

-- ─────────────────────────── Manual: market state journal ───────────────────────────
-- Cause, reference and tick come from transaction-local settings set by setMarketChangeContext();
-- without them INSERT is logged as INITIAL and UPDATE as UNSPECIFIED.
CREATE FUNCTION "market_state_journal"() RETURNS trigger AS $$
DECLARE
  v_cause text := NULLIF(current_setting('app.market_change_cause', true), '');
  v_ref   text := NULLIF(current_setting('app.market_change_ref', true), '');
  v_tick  text := NULLIF(current_setting('app.market_change_tick', true), '');
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."stock"       IS NOT DISTINCT FROM NEW."stock"
     AND OLD."noise"       IS NOT DISTINCT FROM NEW."noise"
     AND OLD."activeEvent" IS NOT DISTINCT FROM NEW."activeEvent"
     AND OLD."cityId"      IS NOT DISTINCT FROM NEW."cityId"
     AND OLD."commodityId" IS NOT DISTINCT FROM NEW."commodityId" THEN
    RETURN NEW; -- nothing relevant changed (e.g. only eventTicksLeft countdown or updatedAt)
  END IF;

  INSERT INTO "MarketStateChange" (
    "id", "cityId", "commodityId",
    "oldStock", "newStock", "oldNoise", "newNoise", "oldEvent", "newEvent",
    "cause", "refId", "tick", "createdAt"
  ) VALUES (
    gen_random_uuid()::text, NEW."cityId", NEW."commodityId",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."stock" END, NEW."stock",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."noise" END, NEW."noise",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."activeEvent" END, NEW."activeEvent",
    COALESCE(v_cause, CASE WHEN TG_OP = 'INSERT' THEN 'INITIAL' ELSE 'UNSPECIFIED' END)::"MarketChangeCause",
    v_ref,
    v_tick::integer,
    clock_timestamp()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MarketState_journal"
AFTER INSERT OR UPDATE ON "MarketState"
FOR EACH ROW EXECUTE FUNCTION "market_state_journal"();

-- ─────────────────────────── Manual: append-only journals ───────────────────────────
CREATE FUNCTION "journal_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MarketStateChange_append_only" BEFORE UPDATE OR DELETE ON "MarketStateChange"
FOR EACH ROW EXECUTE FUNCTION "journal_append_only"();
CREATE TRIGGER "MoneyTransaction_append_only" BEFORE UPDATE OR DELETE ON "MoneyTransaction"
FOR EACH ROW EXECUTE FUNCTION "journal_append_only"();
CREATE TRIGGER "TradeTransaction_append_only" BEFORE UPDATE OR DELETE ON "TradeTransaction"
FOR EACH ROW EXECUTE FUNCTION "journal_append_only"();
CREATE TRIGGER "InventoryMovement_append_only" BEFORE UPDATE OR DELETE ON "InventoryMovement"
FOR EACH ROW EXECUTE FUNCTION "journal_append_only"();
CREATE TRIGGER "ClanTreasuryTransaction_append_only" BEFORE UPDATE OR DELETE ON "ClanTreasuryTransaction"
FOR EACH ROW EXECUTE FUNCTION "journal_append_only"();
