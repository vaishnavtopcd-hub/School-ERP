import { apiRequest } from '@/shared/api';

import type {
  AttendanceOverview,
  AttendanceStatus,
  DailyRegister,
  MonthlyReport,
  StudentAttendance,
} from '../types';

export interface MarkAttendancePayload {
  sectionId: string;
  /** `YYYY-MM-DD`. The API refuses a future date. */
  date: string;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string | null;
  }>;
}

export const attendanceApi = {
  /** Every section and how far its register has got, for the landing screen. */
  overview(date: string): Promise<AttendanceOverview> {
    return apiRequest<AttendanceOverview>({
      method: 'GET',
      url: '/attendance/overview',
      params: { date },
    });
  },

  daily(sectionId: string, date: string): Promise<DailyRegister> {
    return apiRequest<DailyRegister>({
      method: 'GET',
      url: '/attendance/daily',
      params: { sectionId, date },
    });
  },

  /** Returns the register as it stands afterwards, so the screen needs no refetch. */
  mark(input: MarkAttendancePayload): Promise<DailyRegister> {
    return apiRequest<DailyRegister>({ method: 'POST', url: '/attendance/daily', data: input });
  },

  /** Erase a day for one section. Returns how many marks went. */
  clearDay(sectionId: string, date: string): Promise<{ cleared: number }> {
    return apiRequest<{ cleared: number }>({
      method: 'DELETE',
      url: '/attendance/daily',
      params: { sectionId, date },
    });
  },

  monthly(sectionId: string, month: string): Promise<MonthlyReport> {
    return apiRequest<MonthlyReport>({
      method: 'GET',
      url: '/attendance/monthly',
      params: { sectionId, month },
    });
  },

  student(studentId: string, month?: string): Promise<StudentAttendance> {
    return apiRequest<StudentAttendance>({
      method: 'GET',
      url: `/attendance/student/${studentId}`,
      params: month ? { month } : undefined,
    });
  },

  /** Takes no id: the API derives the children from who is asking. */
  myChildren(month?: string): Promise<StudentAttendance[]> {
    return apiRequest<StudentAttendance[]>({
      method: 'GET',
      url: '/attendance/my-children',
      params: month ? { month } : undefined,
    });
  },
};
