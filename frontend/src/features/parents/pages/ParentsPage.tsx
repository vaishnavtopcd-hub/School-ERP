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

import { ParentEditDialog } from '../components/ParentEditDialog';
import { ParentFormDialog } from '../components/ParentFormDialog';
import { ParentStudentsDialog } from '../components/ParentStudentsDialog';
import { ParentsTable } from '../components/ParentsTable';
import { useDeleteParent, useParentsList } from '../hooks/useParents';
import { type ListParentsParams, type Parent } from '../types';

type DialogKind = 'create' | 'edit' | 'students' | 'delete' | null;

const CLASS_FILTER_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

export default function ParentsPage() {
  const { hasPermission } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [classFilter, setClassFilter] = useState('');
  const [linkFilter, setLinkFilter] = useState<'' | 'unlinked'>('');
  const [page, setPage] = useState(0);
  // Matches the table's `rowsPerPageOptions`; a value outside that list makes
  // MUI's pagination select render blank.
  const [pageSize, setPageSize] = useState(25);

  const params = useMemo<ListParentsParams>(
    () => ({
      // The table is 0-based; the API is 1-based.
      page: page + 1,
      limit: pageSize,
      search: search || undefined,
      classId: classFilter || undefined,
      unlinked: linkFilter === 'unlinked' ? true : undefined,
      sortBy: 'firstName',
      sortOrder: 'asc',
    }),
    [page, pageSize, search, classFilter, linkFilter],
  );

  const { data, isFetching, error } = useParentsList(params);
  const { data: classes } = useClassesList(CLASS_FILTER_PARAMS);

  const deleteParent = useDeleteParent();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeParent, setActiveParent] = useState<Parent | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('parent:create');
  const canUpdate = hasPermission('parent:update');
  const canDelete = hasPermission('parent:delete');

  const closeMenu = () => setMenuAnchor(null);
  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    deleteParent.reset();
  };

  const listError = error instanceof ApiError ? error : null;
  const classItems = classes?.items ?? [];

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration"
        title="Parents"
        subtitle="Guardians, how to reach them, and which students they are responsible for."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveParent(null);
                setDialog('create');
              }}
            >
              Add guardian
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
            placeholder="Guardian or child's name"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
            helperText="Also matches a child's name or admission number."
          />

          <TextField
            select
            label="Child's class"
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

          <TextField
            select
            label="Linked"
            value={linkFilter}
            onChange={(event) => {
              setLinkFilter(event.target.value as '' | 'unlinked');
              setPage(0);
            }}
            sx={{ minWidth: 160 }}
            helperText=" "
          >
            <MenuItem value="">
              <em>All guardians</em>
            </MenuItem>
            <MenuItem value="unlinked">No student linked</MenuItem>
          </TextField>
        </Stack>

        <Divider />

        <ParentsTable
          rows={data?.items ?? []}
          total={data?.meta.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          filtered={Boolean(search || classFilter || linkFilter)}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onOpenActions={(parent, anchor) => {
            setActiveParent(parent);
            setMenuAnchor(anchor);
          }}
          onOpenStudents={(parent) => {
            setActiveParent(parent);
            setDialog('students');
          }}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate} onClick={() => openDialog('edit')}>
          <ListItemText>Edit guardian</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canUpdate} onClick={() => openDialog('students')}>
          <ListItemText>Manage students</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem disabled={!canDelete} onClick={() => openDialog('delete')}>
          <ListItemText sx={{ color: 'error.main' }}>Remove guardian record</ListItemText>
        </MenuItem>
      </Menu>

      <ParentFormDialog open={dialog === 'create'} onClose={closeDialog} />

      <ParentEditDialog open={dialog === 'edit'} parent={activeParent} onClose={closeDialog} />

      <ParentStudentsDialog
        open={dialog === 'students'}
        parent={activeParent}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete'}
        title="Remove guardian record"
        confirmLabel="Remove"
        destructive
        isPending={deleteParent.isPending}
        error={deleteParent.error}
        body={
          <>
            Delete the guardian record for{' '}
            <strong>
              {activeParent?.firstName} {activeParent?.lastName}
            </strong>
            ? Occupation, emergency contact, and notes are lost, but{' '}
            <strong>their account and sign-in are kept</strong> — manage those under Users. Any
            student still linked must be unlinked first.
          </>
        }
        onConfirm={() => {
          if (!activeParent) return;
          deleteParent.mutate(activeParent.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
