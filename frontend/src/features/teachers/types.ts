import type { PaginationParams } from '@/shared/types';

export type TeacherStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

/** A subject this teacher is allocated, flattened for display. */
export interface AllocatedSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  classId: string;
  className: string;
}

/** A section this teacher is class teacher of. */
export interface AllocatedSection {
  id: string;
  name: string;
  classId: string;
  className: string;
}

export interface Teacher {
  /**
   * Id of the **user** — what every /teachers route takes. The employment
   * record is optional, so it cannot be the identity.
   */
  id: string;
  /** Same value as `id`, named explicitly. */
  userId: string;
  /**
   * False for someone listed purely on their role: their employment fields
   * read as empty until the first save, which creates the record.
   */
  hasProfile: boolean;

  firstName: string;
  lastName: string;
  email: string;
  status: TeacherStatus;

  phone: string | null;
  avatarUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;

  employeeCode: string | null;
  qualification: string | null;
  specialisation: string | null;
  experienceYears: number;
  /** Date-only, `YYYY-MM-DD`. */
  joinedOn: string | null;
  bio: string | null;

  /** Display names of the roles held — this is why the user is listed. */
  roles: string[];
  roleIds: string[];

  subjects: AllocatedSubject[];
  sections: AllocatedSection[];

  createdAt: string;
  updatedAt: string;
}

/** Mirrors `MAX_EXPERIENCE_YEARS` in the backend's teacher DTO. */
export const MAX_EXPERIENCE_YEARS = 60;

export const SORTABLE_FIELDS = [
  'firstName',
  'employeeCode',
  'experienceYears',
  'joinedOn',
  'createdAt',
] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export const SORT_LABELS: Record<SortableField, string> = {
  firstName: 'Name',
  employeeCode: 'Employee code',
  experienceYears: 'Experience',
  joinedOn: 'Joining date',
  createdAt: 'Date added',
};

/** Conventional name of the role a school's teaching staff hold. */
export const DEFAULT_TEACHER_ROLE_NAME = 'Teacher';

export interface ListTeachersParams extends PaginationParams {
  page: number;
  limit: number;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  /** Narrow to exactly one role. Omitted, any teaching-capable role is listed. */
  roleId?: string;
  classId?: string;
  unallocated?: boolean;
}
