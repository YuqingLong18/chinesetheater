/*
  Warnings:

  - You are about to drop the column `initialPassword` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "initialPassword",
ALTER COLUMN "passwordHash" DROP NOT NULL;
