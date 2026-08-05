export interface ClassTeacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** A medium as embedded in a section. Full record lives in the mediums feature. */
export interface SectionMedium {
  id: string;
  name: string;
}

export interface Section {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  classId: string;
  /** Stream qualifier; `''` when the school does not stream. */
  division: string;
  /** Language of instruction, or null when not recorded. */
  medium: SectionMedium | null;
  classTeacher: ClassTeacher | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  /** Ordering key derived from the name server-side; not user-editable. */
  level: number;

  isActive: boolean;
  academicYearId: string;
  schoolId: string;
  sections: Section[];
  sectionCount: number;
  /** Sum of capacity across *active* sections only. */
  totalCapacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleTeacher extends ClassTeacher {
  /** Already class teacher of another section this academic year. */
  isAssigned: boolean;
  assignedTo: string | null;
}

export const SORTABLE_FIELDS = ['level', 'name', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

/**
 * Shown in the sort control. `level` is the school's own ordering — derived
 * from the name server-side — which is why it is not called "Level" here.
 */
export const SORT_LABELS: Record<SortableField, string> = {
  level: 'Class order',
  name: 'Name',
  createdAt: 'Date added',
};

export interface ListClassesParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  academicYearId?: string;
  isActive?: boolean;
}

export const MAX_SECTION_CAPACITY = 300;
