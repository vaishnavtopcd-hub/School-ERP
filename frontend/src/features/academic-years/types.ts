export const ACADEMIC_YEAR_STATUSES = ['UPCOMING', 'ACTIVE', 'ARCHIVED'] as const;
export type AcademicYearStatus = (typeof ACADEMIC_YEAR_STATUSES)[number];

export const STATUS_LABELS: Record<AcademicYearStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const STATUS_COLORS: Record<AcademicYearStatus, 'success' | 'info' | 'default'> = {
  UPCOMING: 'info',
  ACTIVE: 'success',
  ARCHIVED: 'default',
};

export interface AcademicYear {
  id: string;
  name: string;
  /** Date only, `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  schoolId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

/** Activation archives the outgoing year, so the API reports both. */
export interface ActivateResult {
  activated: AcademicYear;
  archived: AcademicYear | null;
}

export const SORTABLE_FIELDS = ['startDate', 'endDate', 'name', 'status', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export interface ListAcademicYearsParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  status?: AcademicYearStatus;
}
