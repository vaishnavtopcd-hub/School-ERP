import type { PaginationParams } from '@/shared/types';

export const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  GRADUATED: 'Graduated',
  TRANSFERRED: 'Transferred',
};

export const STATUS_COLORS: Record<StudentStatus, 'success' | 'default' | 'info' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  GRADUATED: 'info',
  TRANSFERRED: 'warning',
};

/** A guardian as embedded in a student row. */
export interface StudentGuardian {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  relationship: string;
  isPrimaryContact: boolean;
}

export interface Student {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  /** Date-only, `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  status: StudentStatus;
  schoolId: string;

  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;

  guardians: StudentGuardian[];

  createdAt: string;
  updatedAt: string;
}

export const SORTABLE_FIELDS = ['admissionNo', 'firstName', 'lastName', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export const SORT_LABELS: Record<SortableField, string> = {
  admissionNo: 'Admission no.',
  firstName: 'First name',
  lastName: 'Last name',
  createdAt: 'Date added',
};

export interface ListStudentsParams extends PaginationParams {
  page: number;
  limit: number;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  classId?: string;
  sectionId?: string;
  status?: StudentStatus;
  unlinked?: boolean;
}
