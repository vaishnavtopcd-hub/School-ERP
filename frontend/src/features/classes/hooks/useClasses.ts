import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { classesApi } from '../api/classes.api';
import type { ClassInput, SectionInput, UpdateSectionInput } from '../schemas/class.schemas';
import type { ListClassesParams } from '../types';

const KEY = ['classes'] as const;

export const classKeys = {
  all: KEY,
  list: (params: ListClassesParams) => [...KEY, 'list', params] as const,
  teachers: (academicYearId?: string) => [...KEY, 'teachers', academicYearId] as const,
};

/**
 * `enabled` exists because the API rejects the request outright when the school
 * has no active academic year — callers that already know this hold the query
 * back rather than rendering an error the user cannot act on.
 */
export function useClassesList(params: ListClassesParams, enabled = true) {
  return useQuery({
    queryKey: classKeys.list(params),
    queryFn: () => classesApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

/**
 * Eligible class teachers. Not cached for long: the `isAssigned` flag changes
 * as soon as anyone assigns a section.
 */
export function useEligibleTeachers(academicYearId?: string, enabled = true) {
  return useQuery({
    queryKey: classKeys.teachers(academicYearId),
    queryFn: () => classesApi.teachers(academicYearId),
    enabled,
    staleTime: 30_000,
  });
}

function useClassMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateClass() {
  return useClassMutation((input: ClassInput) => classesApi.create(input));
}

export function useUpdateClass() {
  return useClassMutation(({ id, input }: { id: string; input: Partial<ClassInput> }) =>
    classesApi.update(id, input),
  );
}

export function useDeleteClass() {
  return useClassMutation((id: string) => classesApi.remove(id));
}

export function useCreateSection() {
  return useClassMutation(({ classId, input }: { classId: string; input: SectionInput }) =>
    classesApi.createSection(classId, input),
  );
}

export function useUpdateSection() {
  return useClassMutation(({ id, input }: { id: string; input: UpdateSectionInput }) =>
    classesApi.updateSection(id, input),
  );
}

export function useDeleteSection() {
  return useClassMutation((id: string) => classesApi.removeSection(id));
}
