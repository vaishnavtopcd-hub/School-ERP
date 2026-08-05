import type { Permission, SystemRoleKey, UserRole } from '@/shared/types';

/** Mirrors the backend's UserStatus enum. */
export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** PENDING is not administratively assignable — see the backend DTO. */
export const ASSIGNABLE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type AssignableStatus = (typeof ASSIGNABLE_STATUSES)[number];

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Disabled',
  SUSPENDED: 'Suspended',
  PENDING: 'Pending',
};

export const STATUS_COLORS: Record<UserStatus, 'success' | 'default' | 'error' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  SUSPENDED: 'error',
  PENDING: 'warning',
};

export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  schoolId: string | null;
  roles: UserRole[];
  isLocked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RoleOption {
  id: string;
  name: string;
  systemKey: SystemRoleKey | null;
  /** System roles cannot be edited or deleted. */
  isSystem: boolean;
  description: string | null;
  permissions: Permission[];
}

/** Column names the API will accept for `sortBy`. */
export const SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'email',
  'firstName',
  'lastName',
  'status',
  'lastLoginAt',
] as const;

export type SortableField = (typeof SORTABLE_FIELDS)[number];

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  status?: UserStatus;
  roleId?: string;
  includeDeleted?: boolean;
  /** Omit the signed-in user's own row. */
  excludeSelf?: boolean;
}
