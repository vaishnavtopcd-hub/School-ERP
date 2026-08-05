import type { PaginationParams } from '@/shared/types';

export const RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN'] as const;
export type GuardianRelationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  FATHER: 'Father',
  MOTHER: 'Mother',
  GUARDIAN: 'Guardian',
};

/** A student as embedded in a guardian row. */
export interface LinkedStudent {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  className: string | null;
  sectionName: string | null;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
}

export interface Parent {
  /** Id of the guardian **user** — what every /parents route takes. */
  id: string;
  /** Same value as `id`, named explicitly. */
  userId: string;

  firstName: string;
  lastName: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

  phone: string | null;
  avatarUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;

  occupation: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  notes: string | null;

  roles: string[];
  students: LinkedStudent[];

  createdAt: string;
  updatedAt: string;
}

/** Conventional name of the role a school's guardians hold. */
export const DEFAULT_PARENT_ROLE_NAME = 'Parent';

export const SORTABLE_FIELDS = ['firstName', 'lastName', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export const SORT_LABELS: Record<SortableField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  createdAt: 'Date added',
};

export interface ListParentsParams extends PaginationParams {
  page: number;
  limit: number;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  classId?: string;
  studentId?: string;
  unlinked?: boolean;
}
