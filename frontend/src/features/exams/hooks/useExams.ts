import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { examsApi, type ExamPaperPayload, type ExamPayload } from '../api/exams.api';
import type { ListExamsParams } from '../types';

const KEY = ['exams'] as const;

export const examKeys = {
  all: KEY,
  list: (params: ListExamsParams) => [...KEY, 'list', params] as const,
  detail: (id: string) => [...KEY, 'detail', id] as const,
};

export function useExamsList(params: ListExamsParams, enabled = true) {
  return useQuery({
    queryKey: examKeys.list(params),
    queryFn: () => examsApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useExam(id: string | null) {
  return useQuery({
    queryKey: examKeys.detail(id ?? ''),
    queryFn: () => examsApi.get(id as string),
    enabled: Boolean(id),
  });
}

function useExamMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateExam() {
  return useExamMutation((input: ExamPayload) => examsApi.create(input));
}

export function useUpdateExam() {
  return useExamMutation(({ id, input }: { id: string; input: ExamPayload }) =>
    examsApi.update(id, input),
  );
}

export function useDeleteExam() {
  return useExamMutation((id: string) => examsApi.remove(id));
}

export function usePublishExam() {
  return useExamMutation((id: string) => examsApi.publish(id));
}

export function useArchiveExam() {
  return useExamMutation((id: string) => examsApi.archive(id));
}

export function useAddExamPaper() {
  return useExamMutation(({ id, input }: { id: string; input: ExamPaperPayload }) =>
    examsApi.addPaper(id, input),
  );
}

export function useUpdateExamPaper() {
  return useExamMutation(
    ({ id, paperId, input }: { id: string; paperId: string; input: ExamPaperPayload }) =>
      examsApi.updatePaper(id, paperId, input),
  );
}

export function useRemoveExamPaper() {
  return useExamMutation(({ id, paperId }: { id: string; paperId: string }) =>
    examsApi.removePaper(id, paperId),
  );
}
