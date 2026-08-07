import { apiRequest } from '@/shared/api';
import type { PaginatedResult } from '@/shared/types';

import type { Exam, ExamType, ListExamsParams } from '../types';

export interface ExamPayload {
  name?: string;
  type?: ExamType;
  classId?: string;
  academicYearId?: string | null;
  instructions?: string | null;
}

export interface ExamPaperPayload {
  subjectId?: string;
  /** `YYYY-MM-DD`. */
  date?: string;
  startTime?: string;
  endTime?: string;
  maxMarks?: number;
  passMarks?: number;
  venue?: string | null;
}

export const examsApi = {
  list(params: ListExamsParams): Promise<PaginatedResult<Exam>> {
    return apiRequest<PaginatedResult<Exam>>({ method: 'GET', url: '/exams', params });
  },

  get(id: string): Promise<Exam> {
    return apiRequest<Exam>({ method: 'GET', url: `/exams/${id}` });
  },

  create(input: ExamPayload): Promise<Exam> {
    return apiRequest<Exam>({ method: 'POST', url: '/exams', data: input });
  },

  update(id: string, input: ExamPayload): Promise<Exam> {
    return apiRequest<Exam>({ method: 'PATCH', url: `/exams/${id}`, data: input });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>({ method: 'DELETE', url: `/exams/${id}` });
  },

  // --- Lifecycle; each returns the exam in its new state ---------------------

  publish(id: string): Promise<Exam> {
    return apiRequest<Exam>({ method: 'POST', url: `/exams/${id}/publish` });
  },

  archive(id: string): Promise<Exam> {
    return apiRequest<Exam>({ method: 'POST', url: `/exams/${id}/archive` });
  },

  // --- Schedule; each returns the exam with its updated papers ---------------

  addPaper(id: string, input: ExamPaperPayload): Promise<Exam> {
    return apiRequest<Exam>({ method: 'POST', url: `/exams/${id}/papers`, data: input });
  },

  updatePaper(id: string, paperId: string, input: ExamPaperPayload): Promise<Exam> {
    return apiRequest<Exam>({
      method: 'PATCH',
      url: `/exams/${id}/papers/${paperId}`,
      data: input,
    });
  },

  removePaper(id: string, paperId: string): Promise<Exam> {
    return apiRequest<Exam>({ method: 'DELETE', url: `/exams/${id}/papers/${paperId}` });
  },
};
