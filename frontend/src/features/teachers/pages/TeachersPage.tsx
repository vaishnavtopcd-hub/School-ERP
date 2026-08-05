import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth';
import { useClassesList } from '@/features/classes/hooks/useClasses';
import { useRoleOptions } from '@/features/users/hooks/useUsers';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks';

import { TeacherAllocationsDialog } from '../components/TeacherAllocationsDialog';
import { TeacherEditDialog } from '../components/TeacherEditDialog';
import { TeacherFormDialog } from '../components/TeacherFormDialog';
import { TeachersTable } from '../components/TeachersTable';
import { useDeleteTeacher, useTeachersList } from '../hooks/useTeachers';
import {
  DEFAULT_TEACHER_ROLE_NAME,
  SORTABLE_FIELDS,
  SORT_LABELS,
  type ListTeachersParams,
  type SortableField,
  type Teacher,
} from '../types';

type DialogKind = 'create' | 'edit' | 'allocations' | 'delete' | null;

const CLASS_FILTER_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

export default function TeachersPage() {
  const { hasPermission } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [classFilter, setClassFilter] = useState('');
  /**
   * `null` means "not yet defaulted"; `''` means the user chose every role.
   * The distinction matters because the default is resolved asynchronously,
   * once the role catalogue arrives.
   */
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // Matches the table's `rowsPerPageOptions`; a value outside that list makes
  // MUI's pagination select render blank.
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortableField>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: roles = [], isLoading: rolesLoading } = useRoleOptions();

  /**
   * Default to the school's Teacher role once the catalogue loads.
   *
   * Matching on the role *name* is fine here and only here: it picks a default
   * view, not an authorization outcome. A school that renames the role simply
   * starts on "All roles" — every role stays one click away, and the Role
   * column shows why each person is listed.
   */
  useEffect(() => {
    if (roleFilter !== null || roles.length === 0) return;
    const teacherRole = roles.find((role) => role.name === DEFAULT_TEACHER_ROLE_NAME);
    setRoleFilter(teacherRole?.id ?? '');
  }, [roles, roleFilter]);

  const params = useMemo<ListTeachersParams>(
    () => ({
      // The table is 0-based; the API is 1-based.
      page: page + 1,
      limit: pageSize,
      search: search || undefined,
      roleId: roleFilter || undefined,
      classId: classFilter || undefined,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, search, roleFilter, classFilter, sortBy, sortOrder],
  );

  // Held back until the default is resolved, so the first paint is not a
  // flash of every role followed by the Teacher-only list.
  const { data, isFetching, error } = useTeachersList(params, roleFilter !== null);
  const { data: classes } = useClassesList(CLASS_FILTER_PARAMS);

  const deleteTeacher = useDeleteTeacher();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('teacher:create');
  const canUpdate = hasPermission('teacher:update');
  const canDelete = hasPermission('teacher:delete');

  const closeMenu = () => setMenuAnchor(null);
  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    deleteTeacher.reset();
  };

  const listError = error instanceof ApiError ? error : null;
  const classItems = classes?.items ?? [];

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration"
        title="Teachers"
        subtitle="Everyone holding a teaching role. Editing one records their qualifications and experience."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveTeacher(null);
                setDialog('create');
              }}
            >
              Add teacher
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
            placeholder="Name, email, code, qualification"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
          />

          {/* The list is role-driven, so this is the primary control rather
              than an afterthought filter. */}
          <TextField
            select
            label="Role"
            value={roleFilter ?? ''}
            disabled={rolesLoading}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 180 }}
            helperText=" "
          >
            <MenuItem value="">
              <em>All teaching roles</em>
            </MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Class"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 180 }}
            helperText=" "
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

          <Stack direction="row" gap={1} alignItems="center" sx={{ ml: { sm: 'auto' } }}>
            <TextField
              select
              label="Sort by"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as SortableField);
                setPage(0);
              }}
              sx={{ minWidth: 165 }}
            >
              {SORTABLE_FIELDS.map((field) => (
                <MenuItem key={field} value={field}>
                  {SORT_LABELS[field]}
                </MenuItem>
              ))}
            </TextField>

            <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
              <IconButton
                onClick={() => {
                  setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
                  setPage(0);
                }}
                aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Divider />

        <TeachersTable
          rows={data?.items ?? []}
          total={data?.meta.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          filtered={Boolean(search || classFilter || roleFilter)}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onOpenActions={(teacher, anchor) => {
            setActiveTeacher(teacher);
            setMenuAnchor(anchor);
          }}
          onOpenAllocations={(teacher) => {
            setActiveTeacher(teacher);
            setDialog('allocations');
          }}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate} onClick={() => openDialog('edit')}>
          <ListItemText>Edit teacher</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canUpdate} onClick={() => openDialog('allocations')}>
          <ListItemText>Manage allocations</ListItemText>
        </MenuItem>

        <Divider />

        {/* Nothing to remove for someone listed purely on their role. */}
        <MenuItem
          disabled={!canDelete || !activeTeacher?.hasProfile}
          onClick={() => openDialog('delete')}
        >
          <ListItemText sx={{ color: 'error.main' }}>Remove staff record</ListItemText>
        </MenuItem>
      </Menu>

      <TeacherFormDialog open={dialog === 'create'} onClose={closeDialog} />

      <TeacherEditDialog open={dialog === 'edit'} teacher={activeTeacher} onClose={closeDialog} />

      <TeacherAllocationsDialog
        open={dialog === 'allocations'}
        teacher={activeTeacher}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete'}
        title="Remove staff record"
        confirmLabel="Remove"
        destructive
        isPending={deleteTeacher.isPending}
        error={deleteTeacher.error}
        body={
          <>
            Delete the employment record for{' '}
            <strong>
              {activeTeacher?.firstName} {activeTeacher?.lastName}
            </strong>
            ? Qualification, experience, and employee code are lost, but{' '}
            <strong>their account and sign-in are kept</strong> — and while they still hold a
            teaching role they stay in this list with empty details. Any subject or section
            allocated must be unassigned first.
          </>
        }
        onConfirm={() => {
          if (!activeTeacher) return;
          deleteTeacher.mutate(activeTeacher.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
