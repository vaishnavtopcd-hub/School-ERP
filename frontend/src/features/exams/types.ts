import type { PaginationParams } from '@/shared/types';

export const EXAM_TYPES = ['MIDTERM', 'FINAL', 'UNIT_TEST'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  MIDTERM: 'Midterm',
  FINAL: 'Final',
  UNIT_TEST: 'Unit test',
};

export const EXAM_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const EXAM_STATUS_COLORS: Record<ExamStatus, 'default' | 'success' | 'info'> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

/** What each state means, for the UI to say rather than imply. */
export const EXAM_STATUS_HINTS: Record<ExamStatus, string> = {
  DRAFT: 'Being built. Only the office sees it, and the schedule can still change.',
  PUBLISHED: 'Announced to the school. The schedule is frozen.',
  ARCHIVED: 'Closed for good, kept for the record.',
};

export interface ExamPaper {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  /** Date-only, `YYYY-MM-DD`. */
  date: string;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passMarks: number;
  venue: string | null;
}

export interface Exam {
  id: string;
  name: string;
  type: ExamType;
  status: ExamStatus;

  classId: string;
  className: string;

  academicYearId: string | null;
  academicYearName: string | null;

  instructions: string | null;
  publishedAt: string | null;

  paperCount: number;
  /** First and last paper. Null while nothing is scheduled. */
  startsOn: string | null;
  endsOn: string | null;

  papers: ExamPaper[];

  createdAt: string;
  updatedAt: string;
}

export const SORTABLE_FIELDS = ['name', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export interface ListExamsParams extends PaginationParams {
  page: number;
  limit: number;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  status?: ExamStatus;
  type?: ExamType;
  classId?: string;
}
