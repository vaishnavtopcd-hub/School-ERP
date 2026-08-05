import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { mediumsApi } from '../api/mediums.api';
import type { MediumInput } from '../types';

const KEY = ['mediums'] as const;

export const mediumKeys = {
  all: KEY,
  list: (activeOnly: boolean) => [...KEY, 'list', activeOnly] as const,
};

export function useMediums(activeOnly = false, enabled = true) {
  return useQuery({
    queryKey: mediumKeys.list(activeOnly),
    queryFn: () => mediumsApi.list(activeOnly),
    enabled,
    staleTime: 60_000,
  });
}

function useMediumMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: KEY });
      // Sections embed their medium's name, so a rename must refresh them too.
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useCreateMedium() {
  return useMediumMutation((input: MediumInput) => mediumsApi.create(input));
}

export function useUpdateMedium() {
  return useMediumMutation(({ id, input }: { id: string; input: Partial<MediumInput> }) =>
    mediumsApi.update(id, input),
  );
}

export function useDeleteMedium() {
  return useMediumMutation((id: string) => mediumsApi.remove(id));
}
