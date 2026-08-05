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

import { useActiveAcademicYear } from '@/features/academic-years/hooks/useAcademicYears';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { useDebounce } from '@/shared/hooks';

import { ClassFormDialog } from '../components/ClassFormDialog';
import { ClassesTable } from '../components/ClassesTable';
import { SectionFormDialog } from '../components/SectionFormDialog';
import {
  useClassesList,
  useDeleteClass,
  useDeleteSection,
  useUpdateClass,
} from '../hooks/useClasses';
import {
  SORTABLE_FIELDS,
  SORT_LABELS,
  type SchoolClass,
  type Section,
  type SortableField,
} from '../types';

type DialogKind =
  | 'create-class'
  | 'edit-class'
  | 'delete-class'
  | 'toggle-class'
  | 'section-form'
  | 'delete-section'
  | null;

export default function ClassesPage() {
  const { hasPermission } = useAuth();
  const { data: activeYear, isLoading: yearLoading } = useActiveAcademicYear();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [page, setPage] = useState(0);
  // Matches the table's `rowsPerPageOptions`; a value outside that list makes
  // MUI's pagination select render blank.
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortableField>('level');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const params = useMemo(
    () => ({
      // The table is 0-based; the API is 1-based.
      page: page + 1,
      limit: pageSize,
      search: search || undefined,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, search, sortBy, sortOrder],
  );

  const { data, isFetching, error } = useClassesList(params);

  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const deleteSection = useDeleteSection();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeClass, setActiveClass] = useState<SchoolClass | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('class:create');
  const canUpdate = hasPermission('class:update');
  const canDelete = hasPermission('class:delete');

  const closeMenu = () => setMenuAnchor(null);
  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    setActiveSection(null);
    updateClass.reset();
    deleteClass.reset();
    deleteSection.reset();
  };

  // Field and direction are separate controls now that there are no column
  // headers to click, so choosing a field no longer resets the direction.
  const changeSort = (field: SortableField) => {
    setSortBy(field);
    setPage(0);
  };

  const toggleSortOrder = () => {
    setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    setPage(0);
  };

  const listError = error instanceof ApiError ? error : null;
  const noActiveYear = !yearLoading && !activeYear;

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Classes"
        subtitle={
          activeYear
            ? `Showing classes for ${activeYear.name}.`
            : 'Classes belong to an academic year.'
        }
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={noActiveYear}
              onClick={() => {
                setActiveClass(null);
                setDialog('create-class');
              }}
            >
              Create class
            </Button>
          )
        }
      />

      {noActiveYear && (
        <Alert severity="warning" className="mb-4">
          No academic year is active, so there is nothing to attach classes to. Activate one under
          Academic Years first.
        </Alert>
      )}

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
            placeholder="Class name"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
          />

          <Stack direction="row" gap={1} alignItems="center" sx={{ ml: { sm: 'auto' } }}>
            <TextField
              select
              label="Sort by"
              value={sortBy}
              onChange={(event) => changeSort(event.target.value as SortableField)}
              sx={{ minWidth: 160 }}
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

        <ClassesTable
          rows={data?.items ?? []}
          total={data?.meta.total ?? 0}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          canEdit={canUpdate}
          canDelete={canDelete}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          onOpenActions={(schoolClass, anchor) => {
            setActiveClass(schoolClass);
            setMenuAnchor(anchor);
          }}
          onAddSection={(schoolClass) => {
            setActiveClass(schoolClass);
            setActiveSection(null);
            setDialog('section-form');
          }}
          onEditSection={(schoolClass, section) => {
            setActiveClass(schoolClass);
            setActiveSection(section);
            setDialog('section-form');
          }}
          onDeleteSection={(schoolClass, section) => {
            setActiveClass(schoolClass);
            setActiveSection(section);
            setDialog('delete-section');
          }}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate} onClick={() => openDialog('edit-class')}>
          <ListItemText>Edit class</ListItemText>
        </MenuItem>

        <MenuItem
          disabled={!canCreate}
          onClick={() => {
            setActiveSection(null);
            openDialog('section-form');
          }}
        >
          <ListItemText>Add section</ListItemText>
        </MenuItem>

        <MenuItem disabled={!canUpdate} onClick={() => openDialog('toggle-class')}>
          <ListItemText>
            {activeClass?.isActive ? 'Deactivate class' : 'Activate class'}
          </ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem disabled={!canDelete} onClick={() => openDialog('delete-class')}>
          <ListItemText sx={{ color: 'error.main' }}>Delete class</ListItemText>
        </MenuItem>
      </Menu>

      <ClassFormDialog
        open={dialog === 'create-class' || dialog === 'edit-class'}
        schoolClass={dialog === 'edit-class' ? activeClass : null}
        onClose={closeDialog}
      />

      <SectionFormDialog
        open={dialog === 'section-form'}
        parentClass={activeClass}
        section={activeSection}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'toggle-class'}
        title={activeClass?.isActive ? 'Deactivate class' : 'Activate class'}
        confirmLabel={activeClass?.isActive ? 'Deactivate' : 'Activate'}
        destructive={activeClass?.isActive}
        isPending={updateClass.isPending}
        error={updateClass.error}
        body={
          activeClass?.isActive ? (
            <>
              <strong>{activeClass?.name}</strong> will be marked inactive. Its sections are kept
              and it can be reactivated at any time.
            </>
          ) : (
            <>
              <strong>{activeClass?.name}</strong> will be marked active again.
            </>
          )
        }
        onConfirm={() => {
          if (!activeClass) return;
          updateClass.mutate(
            { id: activeClass.id, input: { isActive: !activeClass.isActive } },
            { onSuccess: closeDialog },
          );
        }}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete-class'}
        title="Delete class"
        confirmLabel="Delete"
        destructive
        isPending={deleteClass.isPending}
        error={deleteClass.error}
        body={
          <>
            Delete <strong>{activeClass?.name}</strong>?
            {activeClass && activeClass.sectionCount > 0 && (
              <>
                {' '}
                Its {activeClass.sectionCount} section
                {activeClass.sectionCount === 1 ? '' : 's'} will be removed too.
              </>
            )}{' '}
            Deactivate instead if you only want to take it out of use.
          </>
        }
        onConfirm={() => {
          if (!activeClass) return;
          deleteClass.mutate(activeClass.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'delete-section'}
        title="Delete section"
        confirmLabel="Delete"
        destructive
        isPending={deleteSection.isPending}
        error={deleteSection.error}
        body={
          <>
            Delete section <strong>{activeSection?.name}</strong> from {activeClass?.name}?
          </>
        }
        onConfirm={() => {
          if (!activeSection) return;
          deleteSection.mutate(activeSection.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
