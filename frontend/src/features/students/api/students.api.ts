import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { ListStudentsParams, Student, StudentStatus } from '../types';

export interface StudentPayload {
  admissionNo?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  status?: StudentStatus;
}

export const studentsApi = {
  list(params: ListStudentsParams): Promise<PaginatedResult<Student>> {
    return apiRequest<PaginatedResult<Student>>({ method: 'GET', url: '/students', params });
  },

  create(input: StudentPayload): Promise<Student> {
    return apiRequest<Student>({ method: 'POST', url: '/students', data: input });
  },

  update(id: string, input: StudentPayload): Promise<Student> {
    return apiRequest<Student>({ method: 'PATCH', url: `/students/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/students/${id}` });
  },
};
