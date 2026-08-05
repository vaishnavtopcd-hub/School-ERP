import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from '../schemas/academic-year.schemas';
import type { AcademicYear, ActivateResult, ListAcademicYearsParams } from '../types';

export const academicYearsApi = {
  list(params: ListAcademicYearsParams): Promise<PaginatedResult<AcademicYear>> {
    return apiRequest<PaginatedResult<AcademicYear>>({
      method: 'GET',
      url: '/academic-years',
      params,
    });
  },

  /** Null when the school has not activated a year yet. */
  active(): Promise<AcademicYear | null> {
    return apiRequest<AcademicYear | null>({ method: 'GET', url: '/academic-years/active' });
  },

  create(input: CreateAcademicYearInput): Promise<AcademicYear> {
    return apiRequest<AcademicYear>({ method: 'POST', url: '/academic-years', data: input });
  },

  update(id: string, input: UpdateAcademicYearInput): Promise<AcademicYear> {
    return apiRequest<AcademicYear>({
      method: 'PATCH',
      url: `/academic-years/${id}`,
      data: input,
    });
  },

  activate(id: string): Promise<ActivateResult> {
    return apiRequest<ActivateResult>({ method: 'PATCH', url: `/academic-years/${id}/activate` });
  },

  archive(id: string): Promise<AcademicYear> {
    return apiRequest<AcademicYear>({ method: 'PATCH', url: `/academic-years/${id}/archive` });
  },
};
