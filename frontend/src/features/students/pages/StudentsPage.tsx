import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useMemo, useState } from 'react';

import { useAuth } from '@/features/auth';
import { useClassesList } from '@/features/classes/hooks/useClasses';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks';

import { StudentFormDialog } from '../components/StudentFormDialog';
import { StudentsTable } from '../components/StudentsTable';
import { useDeleteStudent, useStudentsList } from '../hooks/useStudents';
import {
  STATUS_LABELS,
  STUDENT_STATUSES,
  type ListStudentsParams,
  type Student,
  type StudentStatus,
} from '../types';

type DialogKind = 'create' | 'edit' | 'delete' | null;

const CLASS_FILTER_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

export default function StudentsPage() {
  const { hasPermission } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('');
  const [page, setPage] = useState(0);
  // Matches the table's `rowsPerPageOptions`; a value outside that list makes
  // MUI's pagination select render blank.
  const [pageSize, setPageSize] = useState(25);

  const params = useMemo<ListStudentsParams>(
    () => ({
      // The table is 0-based; the API is 1-based.
      page: page + 1,
      limit: pageSize,
      search: search || undefined,
      classId: classFilter || undefined,
      status: statusFilter || undefined,
      sortBy: 'admissionNo',
      sortOrder: 'asc',
    }),
    [page, pageSize, search, classFilter, statusFilter],
  );

  const { data, isFetching, error } = useStudentsList(params);
  const { data: classes } = useClassesList(CLASS_FILTER_PARAMS);

  const deleteStudent = useDeleteStudent();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('student:create');
  const canUpdate = hasPermission('student:update');
  const canDelete = hasPermission('student:delete');

  const closeMenu = () => setMenuAnchor(null);
  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    deleteStudent.reset();
  };

  const listError = error instanceof ApiError ? error : null;
  const classItems = classes?.items ?? [];

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration"
        title="Students"
        subtitle="The register: who is enrolled, where they are placed, and who to contact."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveStudent(null);
                setDialog('create');
              }}
            >
              Enrol student
            </Button>
          )
        }
      />

      {listError && (
        <Alert severity="error" className="mb-4">
          {listError.message}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1.5}
          alignItems={{ sm: 'center' }}
          className="p-4"
        >
          <TextField
            label="Search"
            placeholder="Name, admission no., or class"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
          />

          <TextField
            select
            label="Class"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">
              <em>All classes</em>
            </MenuItem>
            {classItems.map((schoolClass) => (
              <MenuItem key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StudentStatus | '');
              setPage(0);
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">
              <em>All statuses</em>
            </MenuItem>
            {STUDENT_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Divider />

        <StudentsTable
          rows={data?.items ?? []}
          total={data?.meta.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          filtered={Boolean(search || classFilter || statusFilter)}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onOpenActions={(student, anchor) => {
            setActiveStudent(student);
            setMenuAnchor(anchor);
          }}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate} onClick={() => openDialog('edit')}>
          <ListItemText>Edit student</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem disabled={!canDelete} onClick={() => openDialog('delete')}>
          <ListItemText sx={{ color: 'error.main' }}>Delete student</ListItemText>
        </MenuItem>
      </Menu>

      <StudentFormDialog
        open={dialog === 'create' || dialog === 'edit'}
        student={dialog === 'edit' ? activeStudent : null}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete'}
        title="Delete student"
        confirmLabel="Delete"
        destructive
        isPending={deleteStudent.isPending}
        error={deleteStudent.error}
        body={
          <>
            Delete{' '}
            <strong>
              {activeStudent?.firstName} {activeStudent?.lastName}
            </strong>{' '}
            ({activeStudent?.admissionNo})? Their guardian links go too — the guardians themselves
            are kept. Set the status to <strong>Transferred</strong> or <strong>Graduated</strong>{' '}
            instead to retain the record.
          </>
        }
        onConfirm={() => {
          if (!activeStudent) return;
          deleteStudent.mutate(activeStudent.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
