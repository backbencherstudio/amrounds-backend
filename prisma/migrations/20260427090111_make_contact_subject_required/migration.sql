/*
  Warnings:

  - Made the column `subject` on table `contacts` required. This step will fail if there are existing NULL values in that column.

*/
-- Update existing records
UPDATE "contacts" SET "subject" = 'General Inquiry' WHERE "subject" IS NULL;

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "subject" SET NOT NULL;
