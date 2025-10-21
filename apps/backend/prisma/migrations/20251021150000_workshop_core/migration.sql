-- DropForeignKey
ALTER TABLE "WorkshopMember" DROP CONSTRAINT "WorkshopMember_studentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopMember" DROP CONSTRAINT "WorkshopMember_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopRoom" DROP CONSTRAINT "WorkshopRoom_creatorStudentId_fkey";

-- DropForeignKey
ALTER TABLE "WorkshopRoom" DROP CONSTRAINT "WorkshopRoom_creatorTeacherId_fkey";

-- AlterTable
ALTER TABLE "WorkshopRoom" ALTER COLUMN "updatedAt" DROP DEFAULT;
