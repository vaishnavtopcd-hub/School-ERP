-- Class gains a stream qualifier and a language of instruction.
--
-- `division` is NOT NULL with a '' default rather than nullable: it takes part
-- in the uniqueness constraint below, and Postgres treats NULLs as distinct, so
-- a nullable column would let "Class 10" be created twice with no division set.
ALTER TABLE "school_classes" ADD COLUMN "division" TEXT NOT NULL DEFAULT '';
ALTER TABLE "school_classes" ADD COLUMN "medium" TEXT;

-- Name alone is no longer unique within a year; the pair (name, division) is.
-- Existing rows all take division = '', so this is a no-op for them and cannot
-- collide.
DROP INDEX IF EXISTS "school_classes_academic_year_id_name_key";

CREATE UNIQUE INDEX "school_classes_academic_year_id_name_division_key"
  ON "school_classes"("academic_year_id", "name", "division");
