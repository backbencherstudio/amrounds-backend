/*
  Warnings:

  - You are about to drop the column `question` on the `questions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "questions" DROP COLUMN "question",
ADD COLUMN     "explanation_image" TEXT,
ADD COLUMN     "question_steam" TEXT;
