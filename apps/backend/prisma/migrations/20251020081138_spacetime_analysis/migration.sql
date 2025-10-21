-- CreateEnum
CREATE TYPE "SpacetimeAnalysisType" AS ENUM ('crossCulture', 'sameEra', 'sameGenre');

-- DropIndex
DROP INDEX IF EXISTS "ImageActivity_imageId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ImageActivity_sessionId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ImageActivity_studentId_idx";

-- CreateTable
CREATE TABLE "SpacetimeAnalysis" (
    "analysisId" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "workTitle" TEXT NOT NULL,
    "era" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "analysisType" "SpacetimeAnalysisType" NOT NULL,
    "focusScope" TEXT,
    "promptNotes" TEXT,
    "generatedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpacetimeAnalysis_pkey" PRIMARY KEY ("analysisId")
);

-- AddForeignKey
ALTER TABLE "SpacetimeAnalysis" ADD CONSTRAINT "SpacetimeAnalysis_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacetimeAnalysis" ADD CONSTRAINT "SpacetimeAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
