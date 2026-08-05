import { z } from 'zod';

import { MAX_SECTION_CAPACITY } from '../types';

export const classSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long'),
  // `level` is absent by design: the server derives the ordering key from the
  // name, so asking for it would be asking the user to restate the name.
  isActive: z.boolean().default(true),
});

export const sectionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(20, 'Name is too long'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Use a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(MAX_SECTION_CAPACITY, `Capacity cannot exceed ${MAX_SECTION_CAPACITY}`),
  // Sent as '' when unset — the server stores it that way so it can take part
  // in the (name, division) uniqueness constraint.
  division: z.string().trim().max(40, 'Division is too long').default(''),
  // Empty selection means "no medium"; the API expects null, not "".
  mediumId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  // Empty selection means "no class teacher"; the API expects null, not "".
  classTeacherId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  isActive: z.boolean().default(true),
});

export type ClassInput = z.infer<typeof classSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type UpdateSectionInput = Partial<SectionInput>;
