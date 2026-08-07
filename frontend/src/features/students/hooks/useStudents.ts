import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { studentsApi, type StudentPayload } from '../api/students.api';
import type { ListStudentsParams } from '../types';

const KEY = ['students'] as const;

export const studentKeys = {
  all: KEY,
  list: (params: ListStudentsParams) => [...KEY, 'list', params] as const,
  detail: (id: string) => [...KEY, 'detail', id] as const,
};

export function useStudentsList(params: ListStudentsParams, enabled = true) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => studentsApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

/**
 * One student, for the view and edit pages.
 *
 * They arrive by URL, so the record cannot be assumed to be in the list cache —
 * a reload or a pasted link has nothing behind it.
 */
export function useStudent(id: string | null) {
  return useQuery({
    queryKey: studentKeys.detail(id ?? ''),
    queryFn: () => studentsApi.get(id as string),
    enabled: Boolean(id),
  });
}

/**
 * The number an enrolment would be given, for showing on the form.
 *
 * Not cached between openings: someone else may have enrolled since, and a
 * stale preview would promise a number that is gone.
 */
export function useNextAdmissionNo(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'next-admission-no'],
    queryFn: () => studentsApi.nextAdmissionNo(),
    enabled,
    gcTime: 0,
    staleTime: 0,
  });
}

/** Guardian lists embed students, so those caches go stale on every write. */
function useStudentMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
  });
}

export function useCreateStudent() {
  return useStudentMutation((input: StudentPayload) => studentsApi.create(input));
}

export function useUpdateStudent() {
  return useStudentMutation(({ id, input }: { id: string; input: StudentPayload }) =>
    studentsApi.update(id, input),
  );
}

export function useDeleteStudent() {
  return useStudentMutation((id: string) => studentsApi.remove(id));
}
