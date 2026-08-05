import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { parentsApi, type CreateParentPayload, type UpdateParentPayload } from '../api/parents.api';
import type { GuardianRelationship, ListParentsParams } from '../types';

const KEY = ['parents'] as const;

export const parentKeys = {
  all: KEY,
  list: (params: ListParentsParams) => [...KEY, 'list', params] as const,
  detail: (id: string) => [...KEY, 'detail', id] as const,
};

export function useParentsList(params: ListParentsParams, enabled = true) {
  return useQuery({
    queryKey: parentKeys.list(params),
    queryFn: () => parentsApi.list(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useParent(id: string | null) {
  return useQuery({
    queryKey: parentKeys.detail(id ?? ''),
    queryFn: () => parentsApi.get(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Linking writes to the join table, which the student register reads back as
 * its Guardians column — so that cache is invalidated too.
 */
function useParentMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useCreateParent() {
  return useParentMutation((input: CreateParentPayload) => parentsApi.create(input));
}

export function useUpdateParent() {
  return useParentMutation(({ id, input }: { id: string; input: UpdateParentPayload }) =>
    parentsApi.update(id, input),
  );
}

export function useDeleteParent() {
  return useParentMutation((id: string) => parentsApi.remove(id));
}

export function useLinkStudent() {
  return useParentMutation(
    ({
      id,
      studentId,
      relationship,
      isPrimaryContact,
    }: {
      id: string;
      studentId: string;
      relationship: GuardianRelationship;
      isPrimaryContact?: boolean;
    }) => parentsApi.linkStudent(id, { studentId, relationship, isPrimaryContact }),
  );
}

export function useUpdateLink() {
  return useParentMutation(
    ({
      id,
      studentId,
      ...input
    }: {
      id: string;
      studentId: string;
      relationship?: GuardianRelationship;
      isPrimaryContact?: boolean;
    }) => parentsApi.updateLink(id, studentId, input),
  );
}

export function useUnlinkStudent() {
  return useParentMutation(({ id, studentId }: { id: string; studentId: string }) =>
    parentsApi.unlinkStudent(id, studentId),
  );
}
