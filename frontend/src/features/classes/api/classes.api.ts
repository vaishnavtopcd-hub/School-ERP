import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { ClassInput, SectionInput, UpdateSectionInput } from '../schemas/class.schemas';
import type { EligibleTeacher, ListClassesParams, SchoolClass, Section } from '../types';

export const classesApi = {
  list(params: ListClassesParams): Promise<PaginatedResult<SchoolClass>> {
    return apiRequest<PaginatedResult<SchoolClass>>({
      method: 'GET',
      url: '/classes',
      params,
    });
  },

  teachers(academicYearId?: string): Promise<EligibleTeacher[]> {
    return apiRequest<EligibleTeacher[]>({
      method: 'GET',
      url: '/classes/teachers',
      params: { academicYearId },
    });
  },

  create(input: ClassInput): Promise<SchoolClass> {
    return apiRequest<SchoolClass>({ method: 'POST', url: '/classes', data: input });
  },

  update(id: string, input: Partial<ClassInput>): Promise<SchoolClass> {
    return apiRequest<SchoolClass>({ method: 'PATCH', url: `/classes/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/classes/${id}` });
  },

  createSection(classId: string, input: SectionInput): Promise<Section> {
    return apiRequest<Section>({
      method: 'POST',
      url: `/classes/${classId}/sections`,
      data: input,
    });
  },

  updateSection(sectionId: string, input: UpdateSectionInput): Promise<Section> {
    return apiRequest<Section>({
      method: 'PATCH',
      url: `/classes/sections/${sectionId}`,
      data: input,
    });
  },

  removeSection(sectionId: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/classes/sections/${sectionId}` });
  },
};
