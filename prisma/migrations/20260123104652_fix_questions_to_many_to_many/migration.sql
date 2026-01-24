/*
  Warnings:

  - You are about to drop the column `testId` on the `questions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_testId_fkey";

-- AlterTable
ALTER TABLE "questions" DROP COLUMN "testId";

-- CreateTable
CREATE TABLE "_QuestionsToTest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_QuestionsToTest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_QuestionsToTest_B_index" ON "_QuestionsToTest"("B");

-- AddForeignKey
ALTER TABLE "_QuestionsToTest" ADD CONSTRAINT "_QuestionsToTest_A_fkey" FOREIGN KEY ("A") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionsToTest" ADD CONSTRAINT "_QuestionsToTest_B_fkey" FOREIGN KEY ("B") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
