/*
  Warnings:

  - Added the required column `centralUserId` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_teacherId_fkey";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "centralUserId" INTEGER NOT NULL,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Session_centralUserId_idx" ON "Session"("centralUserId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("teacherId") ON DELETE SET NULL ON UPDATE CASCADE;
