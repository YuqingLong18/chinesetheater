-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lifeJourneyAttempts" INTEGER DEFAULT 0,
ADD COLUMN     "lifeJourneyModel" TEXT,
ADD COLUMN     "lifeJourneyRawResponse" TEXT;
