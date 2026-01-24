/*
  Warnings:

  - The `test_mode` column on the `tests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "tests" DROP COLUMN "test_mode",
ADD COLUMN     "test_mode" TEXT[];
