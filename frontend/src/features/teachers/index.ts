export { teachersApi } from './api/teachers.api';
export type {
  CreateTeacherPayload,
  TeacherContactPayload,
  UpdateTeacherPayload,
} from './api/teachers.api';
export { TeacherAllocationsDialog } from './components/TeacherAllocationsDialog';
export { TeacherEditDialog } from './components/TeacherEditDialog';
export { TeacherFormDialog } from './components/TeacherFormDialog';
export { TeachersTable } from './components/TeachersTable';
export {
  teacherKeys,
  useAllocateSection,
  useAllocateSubject,
  useCreateTeacher,
  useDeallocateSection,
  useDeallocateSubject,
  useDeleteTeacher,
  useTeacher,
  useTeachersList,
  useUpdateTeacher,
} from './hooks/useTeachers';
export * from './schemas/teacher.schemas';
export * from './types';
