-- AlterEnum
ALTER TYPE "WorkshopBoardType" ADD VALUE IF NOT EXISTS 'finalDraft';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "lifeJourney" JSONB,
ADD COLUMN "lifeJourneyGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ImageReaction" (
  "reactionId" SERIAL PRIMARY KEY,
  "imageId" INTEGER NOT NULL,
  "studentId" INTEGER NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageReaction_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("imageId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageReaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageReaction_imageId_studentId_key" UNIQUE ("imageId", "studentId")
);

-- CreateIndex
CREATE INDEX "ImageReaction_sessionId_idx" ON "ImageReaction"("sessionId");

-- CreateTable
CREATE TABLE "ImageComment" (
  "commentId" SERIAL PRIMARY KEY,
  "imageId" INTEGER NOT NULL,
  "studentId" INTEGER NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImageComment_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("imageId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImageComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImageComment_imageId_idx" ON "ImageComment"("imageId");

-- CreateIndex
CREATE INDEX "ImageComment_sessionId_idx" ON "ImageComment"("sessionId");
