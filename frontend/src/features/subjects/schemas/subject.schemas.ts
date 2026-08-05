import { z } from 'zod';

import { MAX_SUBJECT_CREDITS } from '../types';

/** Mirrors the backend DTO's `SUBJECT_CODE` pattern. */
const CODE_PATTERN = /^[A-Za-z0-9-]+$/;

export const subjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code is too long')
    .regex(CODE_PATTERN, 'Use letters, numbers, and hyphens only')
    // Upper-cased here as well as server-side, so the field shows what will be
    // stored rather than snapping to something else on save.
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  classId: z.string().min(1, 'Choose a class'),
  // Empty selection means "unassigned"; the API expects null, not "".
  teacherId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  credits: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Use a whole number')
    .min(0, 'Credits cannot be negative')
    .max(MAX_SUBJECT_CREDITS, `Credits cannot exceed ${MAX_SUBJECT_CREDITS}`),
  isActive: z.boolean().default(true),
});

/** What the form holds before the schema normalises it. */
export type SubjectFormValues = z.input<typeof subjectSchema>;
/** What the API receives. */
export type SubjectInput = z.output<typeof subjectSchema>;
