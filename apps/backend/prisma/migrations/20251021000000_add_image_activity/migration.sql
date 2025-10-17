-- CreateEnum
CREATE TYPE "ImageActionType" AS ENUM ('generation', 'edit');

-- CreateTable
CREATE TABLE "ImageActivity" (
    "activityId" SERIAL PRIMARY KEY,
    "imageId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "actionType" "ImageActionType" NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageActivity_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GeneratedImage"("imageId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageActivity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX "ImageActivity_sessionId_idx" ON "ImageActivity"("sessionId");
CREATE INDEX "ImageActivity_studentId_idx" ON "ImageActivity"("studentId");
CREATE INDEX "ImageActivity_imageId_idx" ON "ImageActivity"("imageId");
