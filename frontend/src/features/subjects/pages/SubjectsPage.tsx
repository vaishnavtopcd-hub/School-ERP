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
import { useMemo, useState } from 'react';

import { useClassesList } from '@/features/classes/hooks/useClasses';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks';

import { SubjectFormDialog } from '../components/SubjectFormDialog';
import { SubjectsTable } from '../components/SubjectsTable';
import { useDeleteSubject, useSubjectsList, useUpdateSubject } from '../hooks/useSubjects';
import {
  SORTABLE_FIELDS,
  type ListSubjectsParams,
  type SortableField,
  type Subject,
} from '../types';

type DialogKind = 'create' | 'edit' | 'delete' | 'toggle' | null;

const SORT_LABELS: Record<SortableField, string> = {
  code: 'Code',
  name: 'Name',
  credits: 'Credits',
  createdAt: 'Date added',
};

/** Enough to cover any school's class list without paging inside a filter. */
const CLASS_FILTER_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

export default function SubjectsPage() {
  const { hasPermission } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(0);
  // Matches the table's `rowsPerPageOptions`; a value outside that list makes
  // MUI's pagination select render blank.
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortableField>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const params = useMemo<ListSubjectsParams>(
    () => ({
      // The table is 0-based; the API is 1-based.
      page: page + 1,
      limit: pageSize,
      search: search || undefined,
      classId: classFilter || undefined,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, search, classFilter, sortBy, sortOrder],
  );

  const { data, isFetching, error } = useSubjectsList(params);
  const { data: classes } = useClassesList(CLASS_FILTER_PARAMS);

  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('subject:create');
  const canUpdate = hasPermission('subject:update');
  const canDelete = hasPermission('subject:delete');

  const closeMenu = () => setMenuAnchor(null);
  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    updateSubject.reset();
    deleteSubject.reset();
  };

  const changeSort = (field: SortableField) => {
    setSortBy(field);
    setPage(0);
  };

  const toggleSortOrder = () => {
    setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    setPage(0);
  };

  const listError = error instanceof ApiError ? error : null;
  const classItems = classes?.items ?? [];

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Subjects"
        subtitle="The curriculum taught to each class, and who teaches it."
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveSubject(null);
                setDialog('create');
              }}
            >
              Add subject
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
            placeholder="Code, name, or class"
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

          <Stack direction="row" gap={1} alignItems="center" sx={{ ml: { sm: 'auto' } }}>
            <TextField
              select
              label="Sort by"
              value={sortBy}
              onChange={(event) => changeSort(event.target.value as SortableField)}
              sx={{ minWidth: 150 }}
            >
              {SORTABLE_FIELDS.map((field) => (
                <MenuItem key={field} value={field}>
                  {SORT_LABELS[field]}
                </MenuItem>
              ))}
            </TextField>

            <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
              <IconButton
                onClick={toggleSortOrder}
                aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Divider />

        <SubjectsTable
          rows={data?.items ?? []}
          total={data?.meta.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          filtered={Boolean(search || classFilter)}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onOpenActions={(subject, anchor) => {
            setActiveSubject(subject);
            setMenuAnchor(anchor);
          }}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate} onClick={() => openDialog('edit')}>
          <ListItemText>Edit subject</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canUpdate} onClick={() => openDialog('toggle')}>
          <ListItemText>
            {activeSubject?.isActive ? 'Deactivate subject' : 'Activate subject'}
          </ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem disabled={!canDelete} onClick={() => openDialog('delete')}>
          <ListItemText sx={{ color: 'error.main' }}>Delete subject</ListItemText>
        </MenuItem>
      </Menu>

      <SubjectFormDialog
        open={dialog === 'create' || dialog === 'edit'}
        subject={dialog === 'edit' ? activeSubject : null}
        // A filtered view implies which class a new subject belongs to.
        defaultClassId={dialog === 'create' ? classFilter || undefined : undefined}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'toggle'}
        title={activeSubject?.isActive ? 'Deactivate subject' : 'Activate subject'}
        confirmLabel={activeSubject?.isActive ? 'Deactivate' : 'Activate'}
        destructive={activeSubject?.isActive}
        isPending={updateSubject.isPending}
        error={updateSubject.error}
        body={
          activeSubject?.isActive ? (
            <>
              <strong>{activeSubject?.name}</strong> will be marked inactive. It stays on record and
              can be reactivated at any time.
            </>
          ) : (
            <>
              <strong>{activeSubject?.name}</strong> will be marked active again.
            </>
          )
        }
        onConfirm={() => {
          if (!activeSubject) return;
          updateSubject.mutate(
            { id: activeSubject.id, input: { isActive: !activeSubject.isActive } },
            { onSuccess: closeDialog },
          );
        }}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete'}
        title="Delete subject"
        confirmLabel="Delete"
        destructive
        isPending={deleteSubject.isPending}
        error={deleteSubject.error}
        body={
          <>
            Delete <strong>{activeSubject?.name}</strong> ({activeSubject?.code}) from{' '}
            {activeSubject?.class.name}? Deactivate instead if you only want to take it out of use.
          </>
        }
        onConfirm={() => {
          if (!activeSubject) return;
          deleteSubject.mutate(activeSubject.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
