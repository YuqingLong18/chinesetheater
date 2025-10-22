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
ALTER TABLE "WorkshopBoard" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkshopRoom" ALTER COLUMN "updatedAt" DROP DEFAULT;
