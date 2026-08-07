export { attendanceApi } from './api/attendance.api';
export type { MarkAttendancePayload } from './api/attendance.api';
export { AttendanceSummary } from './components/AttendanceSummary';
export { AttendanceMatrix } from './components/AttendanceMatrix';
export type { DayChange } from './components/AttendanceMatrix';
export {
  attendanceKeys,
  useAttendanceOverview,
  useClearAttendanceDay,
  useDailyRegister,
  useMarkAttendance,
  useMonthlyReport,
  useMyChildrenAttendance,
  useStudentAttendance,
} from './hooks/useAttendance';
export * from './types';
