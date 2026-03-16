/*
  Warnings:

  - You are about to drop the column `referance` on the `questions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "questions" DROP COLUMN "referance",
ADD COLUMN     "reference" TEXT;
