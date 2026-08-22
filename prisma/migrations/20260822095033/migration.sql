/*
  Warnings:

  - You are about to drop the column `specialityId` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `topicsId` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `specialityId` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_specialityId_fkey";

-- DropForeignKey
ALTER TABLE "questions" DROP CONSTRAINT "questions_topicsId_fkey";

-- DropForeignKey
ALTER TABLE "topics" DROP CONSTRAINT "topics_speciality_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_specialityId_fkey";

-- AlterTable
ALTER TABLE "questions" DROP COLUMN "specialityId",
DROP COLUMN "topicsId";

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "speciality_id" TEXT,
ADD COLUMN     "topic_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "topic" SET DEFAULT ARRAY[]::"topic"[];

-- AlterTable
ALTER TABLE "users" DROP COLUMN "specialityId",
ADD COLUMN     "speciality_id" TEXT;

-- CreateTable
CREATE TABLE "question_specialty_topics" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "question_id" TEXT NOT NULL,
    "speciality_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,

    CONSTRAINT "question_specialty_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_specialty_topics_speciality_id_idx" ON "question_specialty_topics"("speciality_id");

-- CreateIndex
CREATE INDEX "question_specialty_topics_topic_id_idx" ON "question_specialty_topics"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_specialty_topics_question_id_speciality_id_key" ON "question_specialty_topics"("question_id", "speciality_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_speciality_id_fkey" FOREIGN KEY ("speciality_id") REFERENCES "specialities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_speciality_id_fkey" FOREIGN KEY ("speciality_id") REFERENCES "specialities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_speciality_id_fkey" FOREIGN KEY ("speciality_id") REFERENCES "specialities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_specialty_topics" ADD CONSTRAINT "question_specialty_topics_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_specialty_topics" ADD CONSTRAINT "question_specialty_topics_speciality_id_fkey" FOREIGN KEY ("speciality_id") REFERENCES "specialities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_specialty_topics" ADD CONSTRAINT "question_specialty_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
