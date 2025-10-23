-- AlterEnum
ALTER TYPE "WorkshopBoardType" ADD VALUE IF NOT EXISTS 'finalDraft';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "lifeJourney" JSONB,
ADD COLUMN "lifeJourneyGeneratedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "SessionTaskFeature" AS ENUM ('chat', 'writing', 'workshop', 'analysis', 'journey', 'gallery');

-- CreateEnum
CREATE TYPE "SessionTaskSubmissionStatus" AS ENUM ('submitted', 'resubmitted');

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

-- CreateTable
CREATE TABLE "SessionTask" (
  "taskId" SERIAL PRIMARY KEY,
  "sessionId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "feature" "SessionTaskFeature" NOT NULL,
  "config" JSONB,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionTaskSubmission" (
  "submissionId" SERIAL PRIMARY KEY,
  "taskId" INTEGER NOT NULL,
  "studentId" INTEGER NOT NULL,
  "status" "SessionTaskSubmissionStatus" NOT NULL DEFAULT 'submitted',
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionTaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SessionTask"("taskId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionTaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionTaskSubmission_taskId_studentId_key" UNIQUE ("taskId", "studentId")
);

-- CreateIndex
CREATE INDEX "SessionTask_sessionId_orderIndex_idx" ON "SessionTask"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "SessionTaskSubmission_studentId_idx" ON "SessionTaskSubmission"("studentId");
