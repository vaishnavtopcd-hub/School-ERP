export const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type DayOfWeek = (typeof DAYS)[number];

/** Column headings. Short, because seven of them share a row. */
export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export interface Period {
  id: string;
  name: string;
  sequence: number;
  /** 24-hour `HH:mm`. */
  startTime: string;
  endTime: string;
  isBreak: boolean;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntry {
  id: string;
  day: DayOfWeek;

  periodId: string;
  periodName: string;

  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;

  subjectId: string;
  subjectName: string;
  subjectCode: string;

  teacherId: string;
  teacherName: string;

  createdAt: string;
  updatedAt: string;
}

/** A whole week: the ladder, the days, and what sits in them. */
export interface WeeklyTimetable {
  periods: Period[];
  days: DayOfWeek[];
  entries: TimetableEntry[];
}

/** Which week is on screen — a section's, or a teacher's. */
export type TimetableScope = 'section' | 'teacher';
