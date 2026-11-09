-- ADR-013 / T-305: mandatory age confirmation (18+) at registration.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageConfirmedAt" TIMESTAMP(3) NOT NULL;

