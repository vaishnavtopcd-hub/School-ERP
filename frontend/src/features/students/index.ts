export { studentsApi } from './api/students.api';
export type { StudentPayload } from './api/students.api';
export { StudentFormDialog } from './components/StudentFormDialog';
export { StudentsTable } from './components/StudentsTable';
export {
  studentKeys,
  useCreateStudent,
  useDeleteStudent,
  useStudentsList,
  useUpdateStudent,
} from './hooks/useStudents';
export * from './schemas/student.schemas';
export * from './types';
