import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  teachersApi,
  type CreateTeacherPayload,
  type UpdateTeacherPayload,
} from '../api/teachers.api';
import type { ListTeachersParams } from '../types';

const KEY = ['teachers'] as const;

export const teacherKeys = {
  all: KEY,
  list: (params: ListTeachersParams) => [...KEY, 'list', params] as const,
  detail: (id: string) => [...KEY, 'detail', id] as const,
};

export function useTeachersList(params: ListTeachersParams, enabled = true) {
  return useQuery({
    queryKey: teacherKeys.list(params),
    queryFn: () => teachersApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useTeacher(id: string | null) {
  return useQuery({
    queryKey: teacherKeys.detail(id ?? ''),
    queryFn: () => teachersApi.get(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Allocation writes reach into subjects and sections, so those caches are
 * invalidated too — a subject's teacher column is stale the moment this runs.
 */
function useTeacherMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useCreateTeacher() {
  return useTeacherMutation((input: CreateTeacherPayload) => teachersApi.create(input));
}

export function useUpdateTeacher() {
  return useTeacherMutation(({ id, input }: { id: string; input: UpdateTeacherPayload }) =>
    teachersApi.update(id, input),
  );
}

export function useDeleteTeacher() {
  return useTeacherMutation((id: string) => teachersApi.remove(id));
}

export function useAllocateSubject() {
  return useTeacherMutation(({ id, subjectId }: { id: string; subjectId: string }) =>
    teachersApi.allocateSubject(id, subjectId),
  );
}

export function useDeallocateSubject() {
  return useTeacherMutation(({ id, subjectId }: { id: string; subjectId: string }) =>
    teachersApi.deallocateSubject(id, subjectId),
  );
}

export function useAllocateSection() {
  return useTeacherMutation(({ id, sectionId }: { id: string; sectionId: string }) =>
    teachersApi.allocateSection(id, sectionId),
  );
}

export function useDeallocateSection() {
  return useTeacherMutation(({ id, sectionId }: { id: string; sectionId: string }) =>
    teachersApi.deallocateSection(id, sectionId),
  );
}
