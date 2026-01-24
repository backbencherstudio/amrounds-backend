-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "testId" TEXT;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
