/*
  Warnings:

  - You are about to drop the column `answer` on the `answer_options` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "answer_options" DROP COLUMN "answer",
ADD COLUMN     "option_text" TEXT;
