import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { SubjectInput } from '../schemas/subject.schemas';
import type { ListSubjectsParams, Subject } from '../types';

export const subjectsApi = {
  list(params: ListSubjectsParams): Promise<PaginatedResult<Subject>> {
    return apiRequest<PaginatedResult<Subject>>({ method: 'GET', url: '/subjects', params });
  },

  create(input: SubjectInput): Promise<Subject> {
    return apiRequest<Subject>({ method: 'POST', url: '/subjects', data: input });
  },

  update(id: string, input: Partial<SubjectInput>): Promise<Subject> {
    return apiRequest<Subject>({ method: 'PATCH', url: `/subjects/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/subjects/${id}` });
  },
};
