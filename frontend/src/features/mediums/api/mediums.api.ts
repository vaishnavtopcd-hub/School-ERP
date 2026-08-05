import { apiRequest } from '@/shared/api';

import type { Medium, MediumInput } from '../types';

export const mediumsApi = {
  /** `activeOnly` is for pickers — a retired medium should not be offered. */
  list(activeOnly = false): Promise<Medium[]> {
    return apiRequest<Medium[]>({
      method: 'GET',
      url: '/mediums',
      params: activeOnly ? { activeOnly: true } : undefined,
    });
  },

  create(input: MediumInput): Promise<Medium> {
    return apiRequest<Medium>({ method: 'POST', url: '/mediums', data: input });
  },

  update(id: string, input: Partial<MediumInput>): Promise<Medium> {
    return apiRequest<Medium>({ method: 'PATCH', url: `/mediums/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/mediums/${id}` });
  },
};
