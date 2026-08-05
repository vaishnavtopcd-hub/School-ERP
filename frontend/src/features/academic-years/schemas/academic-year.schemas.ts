import { z } from 'zod';

/** Mirrors the backend DTO: date-only, no timezone. */
const dateOnly = z
  .string()
  .min(1, 'Required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form');

const base = z.object({
  name: z.string().trim().min(3, 'Use at least 3 characters').max(40, 'Name is too long'),
  startDate: dateOnly,
  endDate: dateOnly,
});

/**
 * String comparison is correct for `YYYY-MM-DD` and avoids constructing Dates,
 * which would drag the browser's timezone into the check.
 */
const chronological = <T extends { startDate: string; endDate: string }>(schema: z.ZodType<T>) =>
  schema.refine((data) => data.endDate > data.startDate, {
    message: 'The end date must fall after the start date',
    path: ['endDate'],
  });

export const createAcademicYearSchema = chronological(base);
export const updateAcademicYearSchema = chronological(base);

export type CreateAcademicYearInput = z.infer<typeof base>;
export type UpdateAcademicYearInput = z.infer<typeof base>;
