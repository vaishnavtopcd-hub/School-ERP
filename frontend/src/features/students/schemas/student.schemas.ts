import { z } from 'zod';

import { STUDENT_STATUSES } from '../types';

/** Mirrors the backend DTO's `ADMISSION_NO` pattern. */
const ADMISSION_NO = /^[A-Za-z0-9\-/]+$/;

export const studentSchema = z.object({
  admissionNo: z
    .string()
    .trim()
    .min(2, 'Admission number must be at least 2 characters')
    .max(30, 'Admission number is too long')
    .regex(ADMISSION_NO, 'Use letters, numbers, hyphens, and slashes only')
    // Upper-cased here as well as server-side, so the field shows what will be
    // stored rather than snapping to something else on save.
    .transform((value) => value.toUpperCase()),
  firstName: z.string().trim().min(1, 'First name is required').max(80, 'Name is too long'),
  lastName: z.string().trim().min(1, 'Last name is required').max(80, 'Name is too long'),
  dateOfBirth: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  // Empty selection means "not placed yet"; the API expects null, not "".
  classId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  sectionId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  status: z.enum(STUDENT_STATUSES),
});

export type StudentInput = z.output<typeof studentSchema>;
