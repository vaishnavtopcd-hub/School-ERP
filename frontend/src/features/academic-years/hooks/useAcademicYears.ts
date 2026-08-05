import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { academicYearsApi } from '../api/academic-years.api';
import type {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from '../schemas/academic-year.schemas';
import type { ListAcademicYearsParams } from '../types';

const KEY = ['academic-years'] as const;

export const academicYearKeys = {
  all: KEY,
  list: (params: ListAcademicYearsParams) => [...KEY, 'list', params] as const,
  active: () => [...KEY, 'active'] as const,
};

/** `enabled` lets callers without `academic-year:read` skip a request the API would refuse. */
export function useAcademicYearsList(params: ListAcademicYearsParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: academicYearKeys.list(params),
    queryFn: () => academicYearsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

/** The school's current session. Other modules key their defaults off this. */
export function useActiveAcademicYear() {
  return useQuery({
    queryKey: academicYearKeys.active(),
    queryFn: () => academicYearsApi.active(),
    staleTime: 5 * 60_000,
  });
}

function useAcademicYearMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      // Classes are scoped to the active year, so a rollover changes what they show.
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useCreateAcademicYear() {
  return useAcademicYearMutation((input: CreateAcademicYearInput) =>
    academicYearsApi.create(input),
  );
}

export function useUpdateAcademicYear() {
  return useAcademicYearMutation(({ id, input }: { id: string; input: UpdateAcademicYearInput }) =>
    academicYearsApi.update(id, input),
  );
}

export function useActivateAcademicYear() {
  return useAcademicYearMutation((id: string) => academicYearsApi.activate(id));
}

export function useArchiveAcademicYear() {
  return useAcademicYearMutation((id: string) => academicYearsApi.archive(id));
}
