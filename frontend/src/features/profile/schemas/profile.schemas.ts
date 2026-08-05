import { z } from 'zod';

/**
 * Mirrors the backend's `UpdateProfileDto`. Blank strings are normalised to
 * `null` here for the same reason they are there: "cleared" and "never set"
 * should not be two different stored states.
 *
 * Email is absent on purpose — it is the login identity and is not editable
 * without a verification flow.
 */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === '' ? null : value))
    .nullable();

export const profileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(100, 'First name must be 100 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(100, 'Last name must be 100 characters or fewer.'),
  phone: optionalText(30, 'Phone'),
  addressLine1: optionalText(200, 'Address'),
  addressLine2: optionalText(200, 'Address'),
  city: optionalText(100, 'City'),
  state: optionalText(100, 'State'),
  postalCode: optionalText(20, 'Postal code'),
  country: optionalText(100, 'Country'),
});

/** What the form holds before the schema normalises it. */
export type ProfileFormValues = z.input<typeof profileSchema>;
/** What the API receives. */
export type ProfileInput = z.output<typeof profileSchema>;
