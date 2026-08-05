-- Mediums become a per-school table, and division/medium move from the class
-- to the section.

-- 1. The new table.
CREATE TABLE "mediums" (
  "id"         UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "school_id"  UUID         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mediums_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mediums_school_id_name_key" ON "mediums"("school_id", "name");
CREATE INDEX "mediums_school_id_idx" ON "mediums"("school_id");

ALTER TABLE "mediums"
  ADD CONSTRAINT "mediums_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Every existing school gets the default mediums, so sections have something
--    to point at straight away.
INSERT INTO "mediums" ("id", "name", "school_id", "created_at", "updated_at")
SELECT gen_random_uuid(), m.name, s.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "schools" s
CROSS JOIN (VALUES ('English'), ('Malayalam')) AS m(name)
ON CONFLICT DO NOTHING;

-- 3. Section gains the two fields. `division` is NOT NULL with a '' default so
--    it can take part in the uniqueness constraint — Postgres treats NULLs as
--    distinct, so a nullable column would let "A" be created twice undivided.
ALTER TABLE "sections" ADD COLUMN "division" TEXT NOT NULL DEFAULT '';
ALTER TABLE "sections" ADD COLUMN "medium_id" UUID;

ALTER TABLE "sections"
  ADD CONSTRAINT "sections_medium_id_fkey"
  FOREIGN KEY ("medium_id") REFERENCES "mediums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "sections_medium_id_idx" ON "sections"("medium_id");

DROP INDEX IF EXISTS "sections_class_id_name_key";
CREATE UNIQUE INDEX "sections_class_id_name_division_key"
  ON "sections"("class_id", "name", "division");

-- 4. Carry any medium already recorded on a class down to its sections, so the
--    data survives the move rather than being dropped.
UPDATE "sections" sec
SET "medium_id" = m.id
FROM "school_classes" c
JOIN "mediums" m ON m."school_id" = c."school_id" AND m."name" = c."medium"
WHERE sec."class_id" = c."id" AND c."medium" IS NOT NULL;

UPDATE "sections" sec
SET "division" = c."division"
FROM "school_classes" c
WHERE sec."class_id" = c."id" AND c."division" <> '';

-- 5. Class names become unique outright again, so any classes that only
--    differed by division would now collide.
--
--    Renaming rather than merging: merging would have to reparent sections and
--    silently discard one class's capacity and teachers. Appending the division
--    keeps every row and its data, and leaves the decision to merge with the
--    school, which is the only party that knows whether it should happen.
DROP INDEX IF EXISTS "school_classes_academic_year_id_name_division_key";

UPDATE "school_classes" c
SET "name" = c."name" || ' (' || c."division" || ')'
WHERE c."division" <> ''
  AND EXISTS (
    SELECT 1 FROM "school_classes" other
    WHERE other."academic_year_id" = c."academic_year_id"
      AND other."name" = c."name"
      AND other."id" <> c."id"
  );

ALTER TABLE "school_classes" DROP COLUMN "division";
ALTER TABLE "school_classes" DROP COLUMN "medium";

CREATE UNIQUE INDEX "school_classes_academic_year_id_name_key"
  ON "school_classes"("academic_year_id", "name");
