-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');

-- CreateTable
CREATE TABLE "LifeJourneyGeneration" (
    "generationId" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentLocation" INTEGER,
    "totalLocations" INTEGER NOT NULL DEFAULT 6,
    "model" TEXT NOT NULL,
    "teacherEntries" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LifeJourneyGeneration_pkey" PRIMARY KEY ("generationId")
);

-- CreateTable
CREATE TABLE "LifeJourneyLocation" (
    "locationId" SERIAL NOT NULL,
    "generationId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" "LocationStatus" NOT NULL DEFAULT 'pending',
    "name" TEXT,
    "modernName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "period" TEXT,
    "description" TEXT,
    "events" JSONB,
    "geography" JSONB,
    "poems" JSONB,
    "rawResponse" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeJourneyLocation_pkey" PRIMARY KEY ("locationId")
);

-- CreateIndex
CREATE INDEX "LifeJourneyGeneration_sessionId_status_idx" ON "LifeJourneyGeneration"("sessionId", "status");

-- CreateIndex
CREATE INDEX "LifeJourneyLocation_generationId_status_idx" ON "LifeJourneyLocation"("generationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LifeJourneyLocation_generationId_orderIndex_key" ON "LifeJourneyLocation"("generationId", "orderIndex");

-- AddForeignKey
ALTER TABLE "LifeJourneyGeneration" ADD CONSTRAINT "LifeJourneyGeneration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifeJourneyLocation" ADD CONSTRAINT "LifeJourneyLocation_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "LifeJourneyGeneration"("generationId") ON DELETE CASCADE ON UPDATE CASCADE;
