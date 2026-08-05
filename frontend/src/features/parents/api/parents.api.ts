import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { GuardianRelationship, ListParentsParams, Parent } from '../types';

/** Contact details and address, which live on the user row behind the guardian. */
export interface ParentContactPayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface CreateParentPayload {
  /** Promote an existing account. Mutually exclusive with the fields below. */
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  password?: string;
  roleIds?: string[];

  occupation?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  notes?: string | null;
}

export interface UpdateParentPayload {
  occupation?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  notes?: string | null;
  contact?: ParentContactPayload;
}

export const parentsApi = {
  list(params: ListParentsParams): Promise<PaginatedResult<Parent>> {
    return apiRequest<PaginatedResult<Parent>>({ method: 'GET', url: '/parents', params });
  },

  get(id: string): Promise<Parent> {
    return apiRequest<Parent>({ method: 'GET', url: `/parents/${id}` });
  },

  create(input: CreateParentPayload): Promise<Parent> {
    return apiRequest<Parent>({ method: 'POST', url: '/parents', data: input });
  },

  update(id: string, input: UpdateParentPayload): Promise<Parent> {
    return apiRequest<Parent>({ method: 'PATCH', url: `/parents/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/parents/${id}` });
  },

  // --- Student relationships; each returns the refreshed guardian -------------

  linkStudent(
    id: string,
    input: { studentId: string; relationship: GuardianRelationship; isPrimaryContact?: boolean },
  ): Promise<Parent> {
    return apiRequest<Parent>({ method: 'POST', url: `/parents/${id}/students`, data: input });
  },

  updateLink(
    id: string,
    studentId: string,
    input: { relationship?: GuardianRelationship; isPrimaryContact?: boolean },
  ): Promise<Parent> {
    return apiRequest<Parent>({
      method: 'PATCH',
      url: `/parents/${id}/students/${studentId}`,
      data: input,
    });
  },

  unlinkStudent(id: string, studentId: string): Promise<Parent> {
    return apiRequest<Parent>({ method: 'DELETE', url: `/parents/${id}/students/${studentId}` });
  },
};
