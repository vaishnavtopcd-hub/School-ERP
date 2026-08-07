-- Purely additive: two enums and four nullable columns on an existing table, no
-- backfill, so this is safe to apply to a populated database. Every student
-- enrolled before this migration simply has no gender, photo, blood group, or
-- medical note recorded — which is also what "not asked yet" looks like.

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "blood_group" "BloodGroup",
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "medical_notes" TEXT,
ADD COLUMN     "photo_url" TEXT;
