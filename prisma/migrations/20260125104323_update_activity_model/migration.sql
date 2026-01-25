/*
  Warnings:

  - You are about to drop the column `entity_id` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `entity_type` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `activities` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_user_id_fkey";

-- DropIndex
DROP INDEX "activities_user_id_idx";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "entity_id",
DROP COLUMN "entity_type",
DROP COLUMN "user_id";
