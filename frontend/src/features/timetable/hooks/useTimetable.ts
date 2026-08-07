import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  periodsApi,
  timetableApi,
  type PeriodPayload,
  type TimetableEntryPayload,
  type WeeklyQuery,
} from '../api/timetable.api';

const PERIODS_KEY = ['periods'] as const;
const TIMETABLE_KEY = ['timetable'] as const;

export const timetableKeys = {
  periods: PERIODS_KEY,
  weekly: (query: WeeklyQuery | null) => [...TIMETABLE_KEY, 'weekly', query] as const,
};

export function usePeriods(enabled = true) {
  return useQuery({
    queryKey: PERIODS_KEY,
    queryFn: () => periodsApi.list(),
    enabled,
  });
}

export function useWeeklyTimetable(query: WeeklyQuery | null) {
  return useQuery({
    queryKey: timetableKeys.weekly(query),
    queryFn: () => timetableApi.weekly(query as WeeklyQuery),
    enabled: Boolean(query),
    // The grid is what the previous answer was too; keeping it avoids the
    // whole week blanking out while a neighbouring section loads.
    placeholderData: (previous) => previous,
  });
}

/**
 * Periods and lessons invalidate together.
 *
 * The weekly response carries the ladder inside it, so a period edit changes
 * every grid on screen — not just the period list.
 */
function useTimetableMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PERIODS_KEY });
      void queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY });
    },
  });
}

export function useCreatePeriod() {
  return useTimetableMutation((input: PeriodPayload) => periodsApi.create(input));
}

export function useUpdatePeriod() {
  return useTimetableMutation(({ id, input }: { id: string; input: PeriodPayload }) =>
    periodsApi.update(id, input),
  );
}

export function useDeletePeriod() {
  return useTimetableMutation((id: string) => periodsApi.remove(id));
}

export function useCreateEntry() {
  return useTimetableMutation((input: TimetableEntryPayload) => timetableApi.create(input));
}

export function useUpdateEntry() {
  return useTimetableMutation(({ id, input }: { id: string; input: TimetableEntryPayload }) =>
    timetableApi.update(id, input),
  );
}

export function useDeleteEntry() {
  return useTimetableMutation((id: string) => timetableApi.remove(id));
}
