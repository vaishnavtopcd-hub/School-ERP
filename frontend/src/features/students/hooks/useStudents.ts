import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { studentsApi, type StudentPayload } from '../api/students.api';
import type { ListStudentsParams } from '../types';

const KEY = ['students'] as const;

export const studentKeys = {
  all: KEY,
  list: (params: ListStudentsParams) => [...KEY, 'list', params] as const,
};

export function useStudentsList(params: ListStudentsParams, enabled = true) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => studentsApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
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
