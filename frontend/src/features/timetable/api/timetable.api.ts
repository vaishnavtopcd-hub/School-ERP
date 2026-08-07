import { apiRequest } from '@/shared/api';

import type { DayOfWeek, Period, TimetableEntry, WeeklyTimetable } from '../types';

export interface PeriodPayload {
  name?: string;
  sequence?: number;
  startTime?: string;
  endTime?: string;
  isBreak?: boolean;
}

export interface TimetableEntryPayload {
  day?: DayOfWeek;
  periodId?: string;
  sectionId?: string;
  subjectId?: string;
  teacherId?: string;
}

/** Exactly one of these is sent — the API refuses both or neither. */
export type WeeklyQuery = { sectionId: string } | { teacherId: string };

export const periodsApi = {
  list(): Promise<Period[]> {
    return apiRequest<Period[]>({ method: 'GET', url: '/periods' });
  },

  create(input: PeriodPayload): Promise<Period> {
    return apiRequest<Period>({ method: 'POST', url: '/periods', data: input });
  },

  update(id: string, input: PeriodPayload): Promise<Period> {
    return apiRequest<Period>({ method: 'PATCH', url: `/periods/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/periods/${id}` });
  },
};

export const timetableApi = {
  weekly(query: WeeklyQuery): Promise<WeeklyTimetable> {
    return apiRequest<WeeklyTimetable>({ method: 'GET', url: '/timetable/weekly', params: query });
  },

  create(input: TimetableEntryPayload): Promise<TimetableEntry> {
    return apiRequest<TimetableEntry>({ method: 'POST', url: '/timetable', data: input });
  },

  update(id: string, input: TimetableEntryPayload): Promise<TimetableEntry> {
    return apiRequest<TimetableEntry>({ method: 'PATCH', url: `/timetable/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/timetable/${id}` });
  },
};
