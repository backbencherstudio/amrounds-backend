-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('Intern', 'Board', 'Senior');

-- CreateEnum
CREATE TYPE "topic" AS ENUM ('Anesthesia_Medicine', 'Cancer', 'Cleft_Craniofacial', 'Cosmetics', 'Dentoalveolar', 'Implants', 'Orthognathic', 'Pathology', 'Recontraction', 'TMJ', 'Trauma');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approved" BOOLEAN DEFAULT false,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "credentials" TEXT,
ADD COLUMN     "current_practice" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "linkedin" TEXT,
ADD COLUMN     "training_practice" TEXT,
ADD COLUMN     "twitter_x" TEXT,
ADD COLUMN     "verifiy_document" TEXT;

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "question" TEXT,
    "question_title" TEXT,
    "explanation" TEXT,
    "difficulty" "difficulty"[],
    "topic" "topic"[],

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_options" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "answer" TEXT,
    "is_correct" BOOLEAN DEFAULT false,
    "question_id" TEXT,

    CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
