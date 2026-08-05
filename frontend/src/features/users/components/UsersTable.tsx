import LockIcon from '@mui/icons-material/Lock';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridSortModel,
} from '@mui/x-data-grid';

import { dataGridSx } from '@/app/theme';
import { DateCell } from '@/shared/components';

import { STATUS_COLORS, STATUS_LABELS, type ManagedUser } from '../types';

interface UsersTableProps {
  rows: ManagedUser[];
  rowCount: number;
  loading: boolean;
  paginationModel: GridPaginationModel;
  sortModel: GridSortModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  onSortModelChange: (model: GridSortModel) => void;
  onOpenActions: (user: ManagedUser, anchor: HTMLElement) => void;
}

/**
 * Server-driven data grid: pagination and sorting are handed back to the caller
 * rather than done client-side, so the table stays correct at any row count.
 */
export function UsersTable({
  rows,
  rowCount,
  loading,
  paginationModel,
  sortModel,
  onPaginationModelChange,
  onSortModelChange,
  onOpenActions,
}: UsersTableProps) {
  const columns: GridColDef<ManagedUser>[] = [
    {
      field: 'lastName',
      headerName: 'Name',
      flex: 1.4,
      minWidth: 200,
      renderCell: ({ row }) => (
        <Stack justifyContent="center" height="100%">
          <Typography variant="body2" fontWeight={500} noWrap>
            {row.firstName} {row.lastName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {row.email}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'roles',
      headerName: 'Roles',
      flex: 1.2,
      minWidth: 180,
      // Roles live in a join table; ordering by them server-side is not supported.
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center" height="100%">
          {row.roles.length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              None
            </Typography>
          ) : (
            row.roles.map((role) => (
              <Chip
                key={role.id}
                label={role.name}
                size="small"
                // The school's locked Administrator role is worth spotting.
                variant={role.systemKey ? 'filled' : 'outlined'}
                color={role.systemKey ? 'primary' : 'default'}
              />
            ))
          )}
        </Stack>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: ({ row }) => (
        <Stack direction="row" gap={0.5} alignItems="center" height="100%">
          <Chip label={STATUS_LABELS[row.status]} color={STATUS_COLORS[row.status]} size="small" />
          {row.isLocked && (
            <Tooltip title="Temporarily locked after failed sign-in attempts">
              <LockIcon fontSize="small" color="warning" />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: 'lastLoginAt',
      headerName: 'Last sign-in',
      width: 190,
      renderCell: ({ row }) => <DateCell value={row.lastLoginAt} fallback="Never" />,
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      // Was 140, which truncated "30 Jul 2026, 11:00 am" mid-string.
      width: 190,
      renderCell: ({ row }) => <DateCell value={row.createdAt} />,
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      align: 'right',
      renderCell: ({ row }) => (
        <IconButton
          size="small"
          aria-label={`Actions for ${row.firstName} ${row.lastName}`}
          onClick={(event) => onOpenActions(row, event.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box className="w-full">
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        rowCount={rowCount}
        paginationMode="server"
        sortingMode="server"
        paginationModel={paginationModel}
        sortModel={sortModel}
        onPaginationModelChange={onPaginationModelChange}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        disableColumnFilter
        // Two lines of text (name over email) plus breathing room — 64 left a
        // visible gap now that the rest of the chrome is tighter.
        getRowHeight={() => 56}
        columnHeaderHeight={44}
        autoHeight
        sx={dataGridSx}
      />
    </Box>
  );
}
