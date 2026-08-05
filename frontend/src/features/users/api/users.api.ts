import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { AssignableStatus, ListUsersParams, ManagedUser, RoleOption } from '../types';
import type { CreateUserInput, ResetPasswordInput, UpdateUserInput } from '../schemas/user.schemas';

export const usersApi = {
  list(params: ListUsersParams): Promise<PaginatedResult<ManagedUser>> {
    return apiRequest<PaginatedResult<ManagedUser>>({
      method: 'GET',
      url: '/users',
      // Undefined values are dropped by axios, so empty filters are simply absent.
      params,
    });
  },

  get(id: string): Promise<ManagedUser> {
    return apiRequest<ManagedUser>({ method: 'GET', url: `/users/${id}` });
  },

  roles(): Promise<RoleOption[]> {
    return apiRequest<RoleOption[]>({ method: 'GET', url: '/users/roles' });
  },

  create(input: CreateUserInput): Promise<ManagedUser> {
    return apiRequest<ManagedUser>({ method: 'POST', url: '/users', data: input });
  },

  update(id: string, input: UpdateUserInput): Promise<ManagedUser> {
    return apiRequest<ManagedUser>({ method: 'PATCH', url: `/users/${id}`, data: input });
  },

  setStatus(id: string, status: AssignableStatus): Promise<ManagedUser> {
    return apiRequest<ManagedUser>({
      method: 'PATCH',
      url: `/users/${id}/status`,
      data: { status },
    });
  },

  assignRoles(id: string, roleIds: string[]): Promise<ManagedUser> {
    return apiRequest<ManagedUser>({ method: 'PUT', url: `/users/${id}/roles`, data: { roleIds } });
  },

  resetPassword(id: string, input: ResetPasswordInput): Promise<void> {
    return apiRequest<void>({
      method: 'POST',
      url: `/users/${id}/reset-password`,
      data: { newPassword: input.newPassword },
    });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/users/${id}` });
  },
};
