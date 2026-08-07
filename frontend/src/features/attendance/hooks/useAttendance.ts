import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceApi, type MarkAttendancePayload } from '../api/attendance.api';

const KEY = ['attendance'] as const;

export const attendanceKeys = {
  all: KEY,
  overview: (date: string) => [...KEY, 'overview', date] as const,
  daily: (sectionId: string, date: string) => [...KEY, 'daily', sectionId, date] as const,
  monthly: (sectionId: string, month: string) => [...KEY, 'monthly', sectionId, month] as const,
  student: (studentId: string, month?: string) => [...KEY, 'student', studentId, month] as const,
  myChildren: (month?: string) => [...KEY, 'my-children', month] as const,
};

export function useAttendanceOverview(date: string) {
  return useQuery({
    queryKey: attendanceKeys.overview(date),
    queryFn: () => attendanceApi.overview(date),
    placeholderData: (previous) => previous,
  });
}

export function useDailyRegister(sectionId: string | null, date: string) {
  return useQuery({
    queryKey: attendanceKeys.daily(sectionId ?? '', date),
    queryFn: () => attendanceApi.daily(sectionId as string, date),
    enabled: Boolean(sectionId && date),
  });
}

export function useMonthlyReport(sectionId: string | null, month: string) {
  return useQuery({
    queryKey: attendanceKeys.monthly(sectionId ?? '', month),
    queryFn: () => attendanceApi.monthly(sectionId as string, month),
    enabled: Boolean(sectionId && month),
    placeholderData: (previous) => previous,
  });
}

export function useStudentAttendance(studentId: string | null, month?: string) {
  return useQuery({
    queryKey: attendanceKeys.student(studentId ?? '', month),
    queryFn: () => attendanceApi.student(studentId as string, month),
    enabled: Boolean(studentId),
    placeholderData: (previous) => previous,
  });
}

export function useMyChildrenAttendance(month?: string) {
  return useQuery({
    queryKey: attendanceKeys.myChildren(month),
    queryFn: () => attendanceApi.myChildren(month),
    placeholderData: (previous) => previous,
  });
}

/** Erasing a day invalidates the same reads taking it does. */
export function useClearAttendanceDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sectionId, date }: { sectionId: string; date: string }) =>
      attendanceApi.clearDay(sectionId, date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * Taking the register invalidates every read of it — the day, the month it
 * falls in, and any student page showing the same marks.
 */
export function useMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MarkAttendancePayload) => attendanceApi.mark(input),
    onSuccess: (register) => {
      queryClient.setQueryData(attendanceKeys.daily(register.sectionId, register.date), register);
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
