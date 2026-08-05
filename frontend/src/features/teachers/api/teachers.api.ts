import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { ListTeachersParams, Teacher } from '../types';

/** Contact details and photo, which live on the user row behind the teacher. */
export interface TeacherContactPayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface CreateTeacherPayload {
  /** Promote an existing account. Mutually exclusive with the fields below. */
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  password?: string;
  roleIds?: string[];

  employeeCode?: string | null;
  qualification?: string | null;
  specialisation?: string | null;
  experienceYears?: number;
  joinedOn?: string | null;
  bio?: string | null;
}

export interface UpdateTeacherPayload {
  employeeCode?: string | null;
  qualification?: string | null;
  specialisation?: string | null;
  experienceYears?: number;
  joinedOn?: string | null;
  bio?: string | null;
  contact?: TeacherContactPayload;
}

export const teachersApi = {
  list(params: ListTeachersParams): Promise<PaginatedResult<Teacher>> {
    return apiRequest<PaginatedResult<Teacher>>({ method: 'GET', url: '/teachers', params });
  },

  get(id: string): Promise<Teacher> {
    return apiRequest<Teacher>({ method: 'GET', url: `/teachers/${id}` });
  },

  create(input: CreateTeacherPayload): Promise<Teacher> {
    return apiRequest<Teacher>({ method: 'POST', url: '/teachers', data: input });
  },

  update(id: string, input: UpdateTeacherPayload): Promise<Teacher> {
    return apiRequest<Teacher>({ method: 'PATCH', url: `/teachers/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/teachers/${id}` });
  },

  // --- Allocation; each returns the refreshed teacher ------------------------

  allocateSubject(id: string, subjectId: string): Promise<Teacher> {
    return apiRequest<Teacher>({
      method: 'POST',
      url: `/teachers/${id}/subjects`,
      data: { subjectId },
    });
  },

  deallocateSubject(id: string, subjectId: string): Promise<Teacher> {
    return apiRequest<Teacher>({ method: 'DELETE', url: `/teachers/${id}/subjects/${subjectId}` });
  },

  allocateSection(id: string, sectionId: string): Promise<Teacher> {
    return apiRequest<Teacher>({
      method: 'POST',
      url: `/teachers/${id}/sections`,
      data: { sectionId },
    });
  },

  deallocateSection(id: string, sectionId: string): Promise<Teacher> {
    return apiRequest<Teacher>({ method: 'DELETE', url: `/teachers/${id}/sections/${sectionId}` });
  },
};
