import { z } from 'zod';

import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from '../types';

/** Mirrors the backend DTO's `ADMISSION_NO` pattern. */
const ADMISSION_NO = /^[A-Za-z0-9\-/]+$/;

/** Empty selection means "not recorded"; the API expects null, not `''`. */
const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('')])
    .optional()
    .transform((value) => (value ? (value as T[number]) : null));

export const studentSchema = z.object({
  // Optional: left blank, the API allocates the school's next number for the
  // year. Validated only when the office overrides it.
  admissionNo: z
    .string()
    .trim()
    .max(30, 'Admission number is too long')
    .refine((value) => value === '' || value.length >= 2, {
      message: 'Admission number must be at least 2 characters',
    })
    .refine((value) => value === '' || ADMISSION_NO.test(value), {
      message: 'Use letters, numbers, hyphens, and slashes only',
    })
    // Upper-cased here as well as server-side, so the field shows what will be
    // stored rather than snapping to something else on save.
    .transform((value) => value.toUpperCase()),
  firstName: z.string().trim().min(1, 'First name is required').max(80, 'Name is too long'),
  lastName: z.string().trim().min(1, 'Last name is required').max(80, 'Name is too long'),
  dateOfBirth: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  gender: optionalChoice(GENDERS),
  photoUrl: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  bloodGroup: optionalChoice(BLOOD_GROUPS),
  medicalNotes: z
    .string()
    .trim()
    .max(2000, 'Medical information is too long')
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
