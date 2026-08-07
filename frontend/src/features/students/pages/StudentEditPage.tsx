import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';

import { StudentForm } from '../components/StudentForm';
import { useStudent, useUpdateStudent } from '../hooks/useStudents';

export default function StudentEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const { data: student, isLoading, error } = useStudent(id);
  const updateStudent = useUpdateStudent();

  const loadError = error instanceof ApiError ? error : null;

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration · Students"
        title="Edit student"
        subtitle={
          student ? `${student.firstName} ${student.lastName} · ${student.admissionNo}` : undefined
        }
        actions={
          <Button
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(ROUTES.students.detail(id))}
          >
            Back to record
          </Button>
        }
      />

      {loadError && <Alert severity="error">{loadError.message}</Alert>}

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      )}

      {/* Mounted only once the record is here: the form seeds its fields from
          the student, and an empty first render would leave them blank. */}
      {student && (
        <StudentForm
          student={student}
          isPending={updateStudent.isPending}
          error={updateStudent.error}
          submitLabel="Save changes"
          onCancel={() => navigate(ROUTES.students.detail(id))}
          onSubmit={(payload) =>
            updateStudent.mutate(
              { id, input: payload },
              { onSuccess: () => navigate(ROUTES.students.detail(id)) },
            )
          }
        />
      )}
    </Box>
  );
}
