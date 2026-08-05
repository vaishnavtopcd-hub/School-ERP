import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi } from '../api/users.api';
import type { AssignableStatus, ListUsersParams } from '../types';
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput } from '../schemas/user.schemas';

const USERS_KEY = ['users'] as const;

/** Query keys are derived from params so each filter combination caches separately. */
export const usersQueryKeys = {
  all: USERS_KEY,
  list: (params: ListUsersParams) => [...USERS_KEY, 'list', params] as const,
  detail: (id: string) => [...USERS_KEY, 'detail', id] as const,
  roles: () => [...USERS_KEY, 'roles'] as const,
};

/** `enabled` lets callers without `user:read` skip a request the API would refuse. */
export function useUsersList(params: ListUsersParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: usersQueryKeys.list(params),
    queryFn: () => usersApi.list(params),
    // Keeps the previous page on screen while the next one loads, so the table
    // does not collapse to a spinner on every page change.
    placeholderData: (previous) => previous,
  });
}

export function useRoleOptions() {
  return useQuery({
    queryKey: usersQueryKeys.roles(),
    queryFn: () => usersApi.roles(),
    // The role catalogue only changes when the seed is re-run.
    staleTime: 30 * 60_000,
  });
}

/** Every mutation invalidates the whole list namespace — filters are unknowable here. */
function useUsersMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useCreateUser() {
  return useUsersMutation((input: CreateUserInput) => usersApi.create(input));
}

export function useUpdateUser() {
  return useUsersMutation(({ id, input }: { id: string; input: UpdateUserInput }) =>
    usersApi.update(id, input),
  );
}

export function useSetUserStatus() {
  return useUsersMutation(({ id, status }: { id: string; status: AssignableStatus }) =>
    usersApi.setStatus(id, status),
  );
}

export function useAssignRoles() {
  return useUsersMutation(({ id, roleIds }: { id: string; roleIds: string[] }) =>
    usersApi.assignRoles(id, roleIds),
  );
}

export function useResetUserPassword() {
  return useUsersMutation(({ id, input }: { id: string; input: ResetPasswordInput }) =>
    usersApi.resetPassword(id, input),
  );
}

export function useDeleteUser() {
  return useUsersMutation((id: string) => usersApi.remove(id));
}
