-- DropForeignKey
ALTER TABLE "tests" DROP CONSTRAINT "tests_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_answers" DROP CONSTRAINT "user_answers_test_id_fkey";

-- DropForeignKey
ALTER TABLE "user_answers" DROP CONSTRAINT "user_answers_user_id_fkey";

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
