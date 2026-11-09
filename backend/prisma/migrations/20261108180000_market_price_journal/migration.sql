-- T-105: append-only journal of every market price change, written by a DB trigger.

-- CreateEnum
CREATE TYPE "MarketPriceChangeCause" AS ENUM ('INITIAL', 'TRADE', 'TICK', 'EVENT', 'ADMIN', 'UNSPECIFIED');

-- CreateTable
CREATE TABLE "MarketPriceChange" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "oldBuyPrice" BIGINT,
    "newBuyPrice" BIGINT NOT NULL,
    "oldSellPrice" BIGINT,
    "newSellPrice" BIGINT NOT NULL,
    "oldSupply" INTEGER,
    "newSupply" INTEGER NOT NULL,
    "cause" "MarketPriceChangeCause" NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPriceChange_cityId_commodityId_createdAt_idx" ON "MarketPriceChange"("cityId", "commodityId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketPriceChange_commodityId_createdAt_idx" ON "MarketPriceChange"("commodityId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketPriceChange_cause_createdAt_idx" ON "MarketPriceChange"("cause", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketPriceChange" ADD CONSTRAINT "MarketPriceChange_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPriceChange" ADD CONSTRAINT "MarketPriceChange_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Manual: journal trigger on "MarketPrice".
-- Cause and reference are read from transaction-local settings that the application sets via
-- setPriceChangeContext(); without them INSERT is logged as INITIAL and UPDATE as UNSPECIFIED.
CREATE FUNCTION "market_price_journal"() RETURNS trigger AS $$
DECLARE
  v_cause text := NULLIF(current_setting('app.price_change_cause', true), '');
  v_ref   text := NULLIF(current_setting('app.price_change_ref', true), '');
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."buyPrice"    IS NOT DISTINCT FROM NEW."buyPrice"
     AND OLD."sellPrice"   IS NOT DISTINCT FROM NEW."sellPrice"
     AND OLD."supply"      IS NOT DISTINCT FROM NEW."supply"
     AND OLD."cityId"      IS NOT DISTINCT FROM NEW."cityId"
     AND OLD."commodityId" IS NOT DISTINCT FROM NEW."commodityId" THEN
    RETURN NEW; -- nothing relevant changed (e.g. only updatedAt)
  END IF;

  INSERT INTO "MarketPriceChange" (
    "id", "cityId", "commodityId",
    "oldBuyPrice", "newBuyPrice", "oldSellPrice", "newSellPrice", "oldSupply", "newSupply",
    "cause", "refId", "createdAt"
  ) VALUES (
    gen_random_uuid()::text, NEW."cityId", NEW."commodityId",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."buyPrice" END, NEW."buyPrice",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."sellPrice" END, NEW."sellPrice",
    CASE WHEN TG_OP = 'UPDATE' THEN OLD."supply" END, NEW."supply",
    COALESCE(v_cause, CASE WHEN TG_OP = 'INSERT' THEN 'INITIAL' ELSE 'UNSPECIFIED' END)::"MarketPriceChangeCause",
    v_ref,
    clock_timestamp()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MarketPrice_journal"
AFTER INSERT OR UPDATE ON "MarketPrice"
FOR EACH ROW EXECUTE FUNCTION "market_price_journal"();

-- Manual: the journal is append-only.
CREATE FUNCTION "market_price_change_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MarketPriceChange is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MarketPriceChange_append_only"
BEFORE UPDATE OR DELETE ON "MarketPriceChange"
FOR EACH ROW EXECUTE FUNCTION "market_price_change_append_only"();
