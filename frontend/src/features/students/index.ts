export { studentsApi } from './api/students.api';
export type { StudentGuardianPayload, StudentPayload } from './api/students.api';
export { StudentForm } from './components/StudentForm';
export { StudentGuardiansField } from './components/StudentGuardiansField';
export type { StudentGuardianLink } from './components/StudentGuardiansField';
export { StudentsTable } from './components/StudentsTable';
export {
  studentKeys,
  useCreateStudent,
  useDeleteStudent,
  useNextAdmissionNo,
  useStudent,
  useStudentsList,
  useUpdateStudent,
} from './hooks/useStudents';
export * from './schemas/student.schemas';
export * from './types';
