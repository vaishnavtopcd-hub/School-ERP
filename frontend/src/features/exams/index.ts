export { examsApi } from './api/exams.api';
export type { ExamPaperPayload, ExamPayload } from './api/exams.api';
export { AddPaperDialog } from './components/AddPaperDialog';
export { ExamFormDialog } from './components/ExamFormDialog';
export { ExamScheduleTable } from './components/ExamScheduleTable';
export {
  examKeys,
  useAddExamPaper,
  useArchiveExam,
  useCreateExam,
  useDeleteExam,
  useExam,
  useExamsList,
  usePublishExam,
  useRemoveExamPaper,
  useUpdateExam,
  useUpdateExamPaper,
} from './hooks/useExams';
export * from './types';
