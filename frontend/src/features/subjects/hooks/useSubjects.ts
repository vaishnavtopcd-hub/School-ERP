import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { subjectsApi } from '../api/subjects.api';
import type { SubjectInput } from '../schemas/subject.schemas';
import type { ListSubjectsParams } from '../types';

const KEY = ['subjects'] as const;

export const subjectKeys = {
  all: KEY,
  list: (params: ListSubjectsParams) => [...KEY, 'list', params] as const,
};

export function useSubjectsList(params: ListSubjectsParams, enabled = true) {
  return useQuery({
    queryKey: subjectKeys.list(params),
    queryFn: () => subjectsApi.list(params),
    // Keeps the previous page on screen while the next one loads, so paging
    // does not flash an empty table.
    placeholderData: (previous) => previous,
    enabled,
  });
}

function useSubjectMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateSubject() {
  return useSubjectMutation((input: SubjectInput) => subjectsApi.create(input));
}

export function useUpdateSubject() {
  return useSubjectMutation(({ id, input }: { id: string; input: Partial<SubjectInput> }) =>
    subjectsApi.update(id, input),
  );
}

export function useDeleteSubject() {
  return useSubjectMutation((id: string) => subjectsApi.remove(id));
}
