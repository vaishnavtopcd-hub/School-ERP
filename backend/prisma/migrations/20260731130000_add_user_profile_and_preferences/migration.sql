-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
-- Every column is nullable, so this is additive and safe to apply to a
-- populated `users` table: existing rows keep NULL until someone fills the
-- profile in, which the app already treats as "not set".
ALTER TABLE "users" ADD COLUMN     "address_line1" TEXT,
ADD COLUMN     "address_line2" TEXT,
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "theme_preference" "ThemePreference";
