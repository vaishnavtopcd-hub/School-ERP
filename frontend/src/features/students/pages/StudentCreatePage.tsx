import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';

import { StudentForm } from '../components/StudentForm';
import { useCreateStudent } from '../hooks/useStudents';

/**
 * Enrolment, as a page rather than a dialog.
 *
 * On success it goes to the new student's record instead of back to the list:
 * the next thing anyone does with a freshly enrolled student is look at them.
 */
export default function StudentCreatePage() {
  const navigate = useNavigate();
  const createStudent = useCreateStudent();

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration · Students"
        title="Enrol student"
        subtitle="Admission details, placement, and who to contact."
        actions={
          <Button
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(ROUTES.students.list)}
          >
            Back to register
          </Button>
        }
      />

      <StudentForm
        isPending={createStudent.isPending}
        error={createStudent.error}
        submitLabel="Enrol student"
        onCancel={() => navigate(ROUTES.students.list)}
        onSubmit={(payload) =>
          createStudent.mutate(payload, {
            onSuccess: (student) => navigate(ROUTES.students.detail(student.id), { replace: true }),
          })
        }
      />
    </Box>
  );
}
