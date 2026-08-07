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

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

export const BLOOD_GROUPS = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** How a blood group is written on a form, as against how it is stored. */
export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A−',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B−',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB−',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O−',
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
  gender: Gender | null;
  /** Data URL, as with a user's avatar. */
  photoUrl: string | null;
  bloodGroup: BloodGroup | null;
  medicalNotes: string | null;
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
