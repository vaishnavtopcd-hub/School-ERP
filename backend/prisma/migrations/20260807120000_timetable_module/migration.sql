-- Purely additive: one enum and two new tables, no changes to existing rows,
-- so this is safe to apply to a populated database.
--
-- The two unique indexes on timetable_entries are the clash rules. They are
-- indexes rather than application checks because a check can be raced by two
-- concurrent requests and an index cannot.

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "periods" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_break" BOOLEAN NOT NULL DEFAULT false,
    "school_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_entries" (
    "id" UUID NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "period_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "periods_school_id_idx" ON "periods"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "periods_school_id_sequence_key" ON "periods"("school_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "periods_school_id_name_key" ON "periods"("school_id", "name");

-- CreateIndex
CREATE INDEX "timetable_entries_school_id_idx" ON "timetable_entries"("school_id");

-- CreateIndex
CREATE INDEX "timetable_entries_subject_id_idx" ON "timetable_entries"("subject_id");

-- CreateIndex: classroom clash — one section, one lesson at a time.
CREATE UNIQUE INDEX "timetable_entries_section_id_day_period_id_key" ON "timetable_entries"("section_id", "day", "period_id");

-- CreateIndex: teacher clash — one teacher cannot be in two rooms at once.
CREATE UNIQUE INDEX "timetable_entries_teacher_id_day_period_id_key" ON "timetable_entries"("teacher_id", "day", "period_id");

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
