import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { BloodGroup, Gender, ListStudentsParams, Student, StudentStatus } from '../types';

/** A guardian to attach while enrolling. `parentId` is the guardian's user id. */
export interface StudentGuardianPayload {
  parentId: string;
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  isPrimaryContact?: boolean;
}

export interface StudentPayload {
  /** Omit to have the API generate one. */
  admissionNo?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  photoUrl?: string | null;
  bloodGroup?: BloodGroup | null;
  medicalNotes?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  status?: StudentStatus;
  /** On update this replaces the whole set — anyone left out is unlinked. */
  guardians?: StudentGuardianPayload[];
}

export const studentsApi = {
  list(params: ListStudentsParams): Promise<PaginatedResult<Student>> {
    return apiRequest<PaginatedResult<Student>>({ method: 'GET', url: '/students', params });
  },

  get(id: string): Promise<Student> {
    return apiRequest<Student>({ method: 'GET', url: `/students/${id}` });
  },

  /** What enrolling right now would be given. Advisory — someone else may take it. */
  async nextAdmissionNo(): Promise<string> {
    const result = await apiRequest<{ admissionNo: string }>({
      method: 'GET',
      url: '/students/next-admission-no',
    });
    return result.admissionNo;
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
