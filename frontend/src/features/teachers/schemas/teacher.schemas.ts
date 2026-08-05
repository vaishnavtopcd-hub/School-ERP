import { z } from 'zod';

import { MAX_EXPERIENCE_YEARS } from '../types';

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === '' ? null : value))
    .nullable();

/** The employment record — shared by create and edit. */
const profileFields = {
  employeeCode: optionalText(40, 'Employee code'),
  qualification: optionalText(200, 'Qualification'),
  specialisation: optionalText(100, 'Specialisation'),
  experienceYears: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Use a whole number')
    .min(0, 'Experience cannot be negative')
    .max(MAX_EXPERIENCE_YEARS, `Experience cannot exceed ${MAX_EXPERIENCE_YEARS} years`),
  // Date-only. Empty means "not recorded", which the API stores as null.
  joinedOn: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  bio: optionalText(1000, 'Notes'),
};

/**
 * Creating a teacher.
 *
 * Two shapes in one schema, discriminated by `mode`, because the form toggles
 * between them: promote a user who already has an account, or take on someone
 * new — which needs an account created for them.
 */
export const createTeacherSchema = z
  .object({
    mode: z.enum(['new', 'existing']),
    // --- promote path ---
    userId: z.string().optional(),
    // --- new-account path ---
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().optional(),
    roleIds: z.array(z.string()).default([]),
    ...profileFields,
  })
  .superRefine((values, ctx) => {
    const require = (path: keyof typeof values, message: string) => {
      if (!values[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };

    if (values.mode === 'existing') {
      require('userId', 'Choose a user to promote');
      return;
    }

    require('firstName', 'First name is required');
    require('lastName', 'Last name is required');

    if (!values.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Email is required' });
    } else if (!z.string().email().safeParse(values.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Enter a valid email address',
      });
    }

    // Mirrors the API's minimum; the full character rules are enforced there and
    // surfaced as a field error, rather than restated in two places.
    if (!values.password || values.password.length < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password must be at least 12 characters',
      });
    }
  });

/** Editing: the employment record plus the contact details on the user row. */
export const updateTeacherSchema = z.object({
  ...profileFields,
  firstName: z.string().trim().min(1, 'First name is required').max(80, 'Name is too long'),
  lastName: z.string().trim().min(1, 'Last name is required').max(80, 'Name is too long'),
  phone: optionalText(30, 'Phone'),
  addressLine1: optionalText(200, 'Address'),
  addressLine2: optionalText(200, 'Address'),
  city: optionalText(100, 'City'),
  state: optionalText(100, 'State'),
  postalCode: optionalText(20, 'Postal code'),
  country: optionalText(100, 'Country'),
});

export type CreateTeacherInput = z.output<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.output<typeof updateTeacherSchema>;
