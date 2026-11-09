-- Iteration 2: fields requested by the frontend + 5 clan roles + notifications/ticker.
-- Hand-edited from `prisma migrate diff`: renames keep existing data instead of drop/add.

-- ClanRole: LEADER/OFFICER/MEMBER -> GODFATHER/CONSIGLIERE/CAPO/SOLDIER/ASSOCIATE (existing rows are mapped)
BEGIN;
CREATE TYPE "ClanRole_new" AS ENUM ('GODFATHER', 'CONSIGLIERE', 'CAPO', 'SOLDIER', 'ASSOCIATE');
ALTER TABLE "ClanMember" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "ClanMember" ALTER COLUMN "role" TYPE "ClanRole_new" USING (
  CASE "role"::text
    WHEN 'LEADER' THEN 'GODFATHER'
    WHEN 'OFFICER' THEN 'CAPO'
    ELSE 'SOLDIER'
  END
)::"ClanRole_new";
ALTER TYPE "ClanRole" RENAME TO "ClanRole_old";
ALTER TYPE "ClanRole_new" RENAME TO "ClanRole";
DROP TYPE "ClanRole_old";
ALTER TABLE "ClanMember" ALTER COLUMN "role" SET DEFAULT 'ASSOCIATE';
COMMIT;

-- City
ALTER TABLE "City" ADD COLUMN "country" TEXT,
ADD COLUMN "policeStrength" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "population" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "techLevel" INTEGER NOT NULL DEFAULT 1;

-- CityConnection: distance -> distanceKm
ALTER TABLE "CityConnection" RENAME COLUMN "distance" TO "distanceKm";

-- Commodity
ALTER TABLE "Commodity" ADD COLUMN "description" TEXT,
ADD COLUMN "illegal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "unitWeightG" INTEGER NOT NULL DEFAULT 1;

-- EquipmentType
ALTER TABLE "EquipmentType" ADD COLUMN "description" TEXT,
ADD COLUMN "weightG" INTEGER NOT NULL DEFAULT 0;

-- InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN "avgBuyPrice" BIGINT NOT NULL DEFAULT 0;

-- Player
ALTER TABLE "Player" ADD COLUMN "heat" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastSeenAt" TIMESTAMP(3);
CREATE INDEX "Player_lastSeenAt_idx" ON "Player"("lastSeenAt");

-- VehicleType: capacity -> capacityG, speed -> speedKmh
ALTER TABLE "VehicleType" RENAME COLUMN "capacity" TO "capacityG";
ALTER TABLE "VehicleType" RENAME COLUMN "speed" TO "speedKmh";
ALTER TABLE "VehicleType" ADD COLUMN "licenseClass" TEXT;

-- Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_playerId_readAt_createdAt_idx" ON "Notification"("playerId", "readAt", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TickerEvent
CREATE TABLE "TickerEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TickerEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TickerEvent_createdAt_idx" ON "TickerEvent"("createdAt");

-- Manual: integrity checks (independent of balancing)
ALTER TABLE "Player" ADD CONSTRAINT "Player_heat_range" CHECK ("heat" >= 0 AND "heat" <= 100);
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_unitWeightG_positive" CHECK ("unitWeightG" > 0);
ALTER TABLE "VehicleType" ADD CONSTRAINT "VehicleType_capacityG_nonnegative" CHECK ("capacityG" >= 0);
