export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  LATE: 'Late',
};

/** Single letters for the monthly grid, where a column is a few pixels wide. */
export const STATUS_INITIALS: Record<AttendanceStatus, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LEAVE: 'L',
  LATE: 'T',
};

export const STATUS_COLORS: Record<AttendanceStatus, 'success' | 'error' | 'info' | 'warning'> = {
  PRESENT: 'success',
  ABSENT: 'error',
  LEAVE: 'info',
  LATE: 'warning',
};

/** One section on the landing screen: how big it is, and whether today is done. */
export interface SectionOverviewRow {
  sectionId: string;
  classId: string;
  className: string;
  sectionName: string;
  /** False for a retired section — listed only while students remain in it. */
  isActive: boolean;
  students: number;
  marked: number;
  isComplete: boolean;
  /** Absent, on leave, or late — the exceptions. */
  away: number;
}

export interface AttendanceOverview {
  date: string;
  sections: SectionOverviewRow[];
}

export interface RegisterRow {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  /** Null means this student has not been marked for this date. */
  status: AttendanceStatus | null;
  remarks: string | null;
}

export interface DailyRegister {
  date: string;
  sectionId: string;
  className: string;
  sectionName: string;
  isComplete: boolean;
  students: RegisterRow[];
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  leave: number;
  late: number;
  /** Days marked. Unmarked days are not counted. */
  marked: number;
  /** Present and late over days marked. Null when nothing is marked. */
  percentage: number | null;
}

export interface MonthlyStudentRow {
  studentId: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  counts: AttendanceCounts;
  /** Keyed by `YYYY-MM-DD`. A missing key is a day never marked. */
  byDate: Record<string, AttendanceStatus>;
}

export interface MonthlyReport {
  month: string;
  sectionId: string;
  className: string;
  sectionName: string;
  /** Only the days that were actually taken, ascending. */
  dates: string[];
  students: MonthlyStudentRow[];
}

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
}

/** One student's month — what the profile tab and a parent both read. */
export interface StudentAttendance {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  className: string | null;
  sectionName: string | null;
  month: string;
  counts: AttendanceCounts;
  days: AttendanceDay[];
}

/** `YYYY-MM` for today, the default every report opens on. */
export const currentMonth = (): string => new Date().toISOString().slice(0, 7);

/** `YYYY-MM-DD` for today, in the school's local reckoning rather than UTC. */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
