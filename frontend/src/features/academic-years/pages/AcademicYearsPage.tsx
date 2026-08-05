import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { dataGridSx } from '@/app/theme';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, DateCell, PageHeader } from '@/shared/components';
import { CREATE_PARAM } from '@/shared/components/layout/navigation';

import { AcademicYearFormDialog } from '../components/AcademicYearFormDialog';
import {
  useAcademicYearsList,
  useActivateAcademicYear,
  useArchiveAcademicYear,
} from '../hooks/useAcademicYears';
import { STATUS_COLORS, STATUS_LABELS, type AcademicYear, type SortableField } from '../types';

type DialogKind = 'create' | 'edit' | 'activate' | 'archive' | null;

export default function AcademicYearsPage() {
  const { hasPermission } = useAuth();

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'startDate', sort: 'desc' }]);

  const params = useMemo(
    () => ({
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      sortBy: (sortModel[0]?.field ?? 'startDate') as SortableField,
      sortOrder: sortModel[0]?.sort ?? 'desc',
    }),
    [paginationModel, sortModel],
  );

  const { data, isFetching, error } = useAcademicYearsList(params);
  const activate = useActivateAcademicYear();
  const archive = useArchiveAcademicYear();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeRow, setActiveRow] = useState<AcademicYear | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const canCreate = hasPermission('academic-year:create');
  const canUpdate = hasPermission('academic-year:update');
  const canActivate = hasPermission('academic-year:activate');
  const canArchive = hasPermission('academic-year:archive');

  const currentActive = data?.items.find((year) => year.status === 'ACTIVE') ?? null;
  const isArchived = activeRow?.status === 'ARCHIVED';

  // The sidebar's `+` navigates here with a flag rather than reaching into this
  // page's state. The flag is consumed so a reload does not reopen the dialog.
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get(CREATE_PARAM) !== '1') return;

    if (canCreate) {
      setActiveRow(null);
      setDialog('create');
    }

    const next = new URLSearchParams(searchParams);
    next.delete(CREATE_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  const closeMenu = () => setMenuAnchor(null);
  const openDialog = (kind: DialogKind) => {
    closeMenu();
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    activate.reset();
    archive.reset();
  };

  const columns: GridColDef<AcademicYear>[] = [
    {
      field: 'name',
      headerName: 'Academic year',
      flex: 1,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Stack direction="row" gap={1} alignItems="center" height="100%">
          <Typography variant="body2" fontWeight={500}>
            {row.name}
          </Typography>
          {row.isCurrent && (
            <Chip label="Today falls in this range" size="small" variant="outlined" />
          )}
        </Stack>
      ),
    },
    {
      field: 'startDate',
      headerName: 'Starts',
      width: 150,
      renderCell: ({ row }) => <DateCell value={row.startDate} kind="date" />,
    },
    {
      field: 'endDate',
      headerName: 'Ends',
      width: 150,
      renderCell: ({ row }) => <DateCell value={row.endDate} kind="date" />,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: ({ row }) => (
        <Chip label={STATUS_LABELS[row.status]} color={STATUS_COLORS[row.status]} size="small" />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      align: 'right',
      renderCell: ({ row }) => (
        <IconButton
          size="small"
          aria-label={`Actions for ${row.name}`}
          onClick={(event) => {
            setActiveRow(row);
            setMenuAnchor(event.currentTarget);
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const listError = error instanceof ApiError ? error : null;

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Academic years"
        subtitle="Exactly one year is active at a time. Classes and enrolment follow it."
        meta={
          currentActive && (
            <Chip label={`${currentActive.name} active`} size="small" color="success" />
          )
        }
        actions={
          canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setActiveRow(null);
                setDialog('create');
              }}
            >
              Create year
            </Button>
          )
        }
      />

      {listError && (
        <Alert severity="error" className="mb-4">
          {listError.message}
        </Alert>
      )}

      {!isFetching && data && !currentActive && (
        <Alert severity="warning" className="mb-4">
          No academic year is active. Classes cannot be created until one is activated.
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          rowCount={data?.meta.total ?? 0}
          paginationMode="server"
          sortingMode="server"
          paginationModel={paginationModel}
          sortModel={sortModel}
          onPaginationModelChange={setPaginationModel}
          onSortModelChange={setSortModel}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          disableColumnFilter
          rowHeight={52}
          columnHeaderHeight={44}
          autoHeight
          sx={dataGridSx}
        />
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem disabled={!canUpdate || isArchived} onClick={() => openDialog('edit')}>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        <MenuItem
          // An archived year is terminal, and the active one is already active.
          disabled={!canActivate || isArchived || activeRow?.status === 'ACTIVE'}
          onClick={() => openDialog('activate')}
        >
          <ListItemText>Make active</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem disabled={!canArchive || isArchived} onClick={() => openDialog('archive')}>
          <ListItemText sx={{ color: 'error.main' }}>Archive</ListItemText>
        </MenuItem>
      </Menu>

      <AcademicYearFormDialog
        open={dialog === 'create' || dialog === 'edit'}
        year={dialog === 'edit' ? activeRow : null}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'activate'}
        title="Make this the active year"
        confirmLabel="Activate"
        isPending={activate.isPending}
        error={activate.error}
        body={
          <>
            <strong>{activeRow?.name}</strong> will become the active academic year.
            {currentActive && currentActive.id !== activeRow?.id && (
              <>
                {' '}
                <strong>{currentActive.name}</strong> will be archived at the same time, and cannot
                be reactivated afterwards.
              </>
            )}
          </>
        }
        onConfirm={() => {
          if (!activeRow) return;
          activate.mutate(activeRow.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />

      <ConfirmActionDialog
        open={dialog === 'archive'}
        title="Archive academic year"
        confirmLabel="Archive"
        destructive
        isPending={archive.isPending}
        error={archive.error}
        body={
          <>
            Archive <strong>{activeRow?.name}</strong>? This is permanent — an archived year becomes
            read-only, its classes can no longer be changed, and it cannot be reactivated.
          </>
        }
        onConfirm={() => {
          if (!activeRow) return;
          archive.mutate(activeRow.id, { onSuccess: closeDialog });
        }}
        onClose={closeDialog}
      />
    </Box>
  );
}
