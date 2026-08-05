import { z } from 'zod';

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === '' ? null : value))
    .nullable();

/** The guardian record — shared by create and edit. */
const profileFields = {
  occupation: optionalText(100, 'Occupation'),
  emergencyContactName: optionalText(120, 'Emergency contact name'),
  emergencyContactPhone: optionalText(30, 'Emergency contact phone'),
  emergencyContactRelation: optionalText(60, 'Relationship'),
  notes: optionalText(1000, 'Notes'),
};

/**
 * Creating a guardian: promote an existing account, or make a new one. Same
 * two-mode shape as the teacher form, for the same reason — both cases are real.
 */
export const createParentSchema = z
  .object({
    mode: z.enum(['new', 'existing']),
    userId: z.string().optional(),
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
      require('userId', 'Choose a user');
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

    // Mirrors the API's minimum; the full character rules are enforced there
    // and surfaced as a field error rather than restated in two places.
    if (!values.password || values.password.length < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password must be at least 12 characters',
      });
    }
  });

/** Editing: the guardian record plus contact details and address. */
export const updateParentSchema = z.object({
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

export type CreateParentInput = z.output<typeof createParentSchema>;
export type UpdateParentInput = z.output<typeof updateParentSchema>;
