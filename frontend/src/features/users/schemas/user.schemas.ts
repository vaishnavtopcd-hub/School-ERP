import { z } from 'zod';

import { ASSIGNABLE_STATUSES } from '../types';

/**
 * Mirrors the backend DTOs in backend/src/modules/users/dto. Client-side
 * validation is for fast feedback only — the API re-validates everything.
 */

/** Must stay in step with PASSWORD_PATTERN in the backend's password.dto.ts. */
const strongPassword = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Must be 128 characters or fewer')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number')
  .regex(/[^A-Za-z\d]/, 'Include a symbol');

const nameField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(80, `${label} is too long`);

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(255)
  .toLowerCase();

const phoneField = z
  .string()
  .trim()
  .max(30, 'Phone number is too long')
  .optional()
  // An empty input should clear the field, not send "".
  .transform((value) => (value === '' ? undefined : value));

export const createUserSchema = z.object({
  email: emailField,
  firstName: nameField('First name'),
  lastName: nameField('Last name'),
  phone: phoneField,
  password: strongPassword,
  status: z.enum(ASSIGNABLE_STATUSES).default('ACTIVE'),
  roleIds: z.array(z.string().uuid()).default([]),
});

/** Profile fields only — status, roles, and password have their own endpoints. */
export const updateUserSchema = z.object({
  email: emailField,
  firstName: nameField('First name'),
  lastName: nameField('Last name'),
  phone: phoneField,
});

export const resetPasswordSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const assignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AssignRolesInput = z.infer<typeof assignRolesSchema>;
