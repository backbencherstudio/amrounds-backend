/*
  Warnings:

  - Added the required column `difficulty` to the `tests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `test_mode` to the `tests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "difficulty" "difficulty" NOT NULL,
ADD COLUMN     "test_mode" TEXT NOT NULL,
ADD COLUMN     "topic" "topic"[];
