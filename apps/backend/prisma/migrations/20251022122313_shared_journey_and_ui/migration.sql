/*
  Warnings:

  - Made the column `createdAt` on table `ImageComment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `ImageReaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "WorkshopMember" DROP CONSTRAINT "WorkshopMember_studentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopMember" DROP CONSTRAINT "WorkshopMember_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopRoom" DROP CONSTRAINT "WorkshopRoom_creatorStudentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopRoom" DROP CONSTRAINT "WorkshopRoom_creatorTeacherId_fkey";

-- DropIndex
DROP INDEX "WorkshopReaction_boardId_idx";

-- DropIndex
DROP INDEX "WorkshopReaction_contributionId_idx";

-- AlterTable
ALTER TABLE "ImageComment" ALTER COLUMN "createdAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "ImageReaction" ALTER COLUMN "createdAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "WorkshopBoard" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkshopRoom" ALTER COLUMN "updatedAt" DROP DEFAULT;
