/*
  Warnings:

  - Made the column `user_id` on table `educations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `experiences` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `publications` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `skills` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "educations" DROP CONSTRAINT "educations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "experiences" DROP CONSTRAINT "experiences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "publications" DROP CONSTRAINT "publications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "skills" DROP CONSTRAINT "skills_user_id_fkey";

-- AlterTable
ALTER TABLE "educations" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "experiences" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "publications" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "skills" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "following_id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE INDEX "follows_follower_id_following_id_idx" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_following_id_follower_id_key" ON "follows"("following_id", "follower_id");

-- CreateIndex
CREATE INDEX "educations_user_id_idx" ON "educations"("user_id");

-- CreateIndex
CREATE INDEX "experiences_user_id_idx" ON "experiences"("user_id");

-- CreateIndex
CREATE INDEX "publications_user_id_idx" ON "publications"("user_id");

-- CreateIndex
CREATE INDEX "skills_user_id_idx" ON "skills"("user_id");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educations" ADD CONSTRAINT "educations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
