import type { PaginationParams } from '@/shared/types';

/** The class a subject is taught to, as embedded in a subject row. */
export interface SubjectClass {
  id: string;
  name: string;
}

export interface SubjectTeacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Subject {
  id: string;
  /** Short institutional identifier, stored upper-cased. Unique in its class. */
  code: string;
  name: string;
  credits: number;
  isActive: boolean;
  schoolId: string;
  class: SubjectClass;
  /** Null while the subject is unstaffed. */
  teacher: SubjectTeacher | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `MAX_SUBJECT_CREDITS` in the backend's subject DTO. */
export const MAX_SUBJECT_CREDITS = 20;

export const SORTABLE_FIELDS = ['code', 'name', 'credits', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export interface ListSubjectsParams extends PaginationParams {
  page: number;
  limit: number;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  classId?: string;
  teacherId?: string;
  isActive?: boolean;
}
