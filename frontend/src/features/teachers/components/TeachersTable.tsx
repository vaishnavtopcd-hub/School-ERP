import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { initials } from '@/shared/utils';

import type { Teacher } from '../types';

const COLUMN_COUNT = 7;

/** Mirrors the DataGrid styling used elsewhere so lists read as one component. */
const tableSx = {
  '& .MuiTableCell-root': { borderColor: 'divider' },
  '& .MuiTableCell-head': {
    backgroundColor: 'action.hover',
    fontWeight: 700,
    fontSize: '0.6875rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    whiteSpace: 'nowrap',
  },
  '& .MuiTableCell-root[align="right"]': { fontVariantNumeric: 'tabular-nums' },
} as const;

interface TeachersTableProps {
  rows: Teacher[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  filtered: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenActions: (teacher: Teacher, anchor: HTMLElement) => void;
  onOpenAllocations: (teacher: Teacher) => void;
}

export function TeachersTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  filtered,
  onPageChange,
  onPageSizeChange,
  onOpenActions,
  onOpenAllocations,
}: TeachersTableProps) {
  return (
    <Box>
      <Box sx={{ position: 'relative' }}>
        {loading && (
          <LinearProgress
            sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 2, height: 2 }}
          />
        )}

        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Teacher</TableCell>
                <TableCell width={170}>Role</TableCell>
                <TableCell width={130}>Employee code</TableCell>
                <TableCell width={210}>Qualification</TableCell>
                <TableCell width={110} align="right">
                  Experience
                </TableCell>
                <TableCell width={200}>Allocations</TableCell>
                <TableCell width={60} align="right" />
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} sx={{ borderBottom: 0 }}>
                    <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                      <BadgeOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                      <Typography variant="subtitle2" color="text.secondary">
                        {filtered ? 'No matching teachers' : 'No teachers yet'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {filtered
                          ? 'Try a different role, search term, or clear the filters.'
                          : 'Nobody holds a role with class access yet. Assign one under Users, or add a teacher.'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ '& > .MuiTableCell-root': { py: 1.25 } }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Avatar
                        src={row.avatarUrl ?? undefined}
                        sx={{
                          width: 34,
                          height: 34,
                          fontSize: '0.75rem',
                          bgcolor: 'primary.main',
                          opacity: row.status === 'ACTIVE' ? 1 : 0.5,
                        }}
                      >
                        {initials(row)}
                      </Avatar>

                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {row.firstName} {row.lastName}
                          </Typography>
                          {row.status !== 'ACTIVE' && (
                            <Chip label={row.status.toLowerCase()} size="small" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {row.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  {/* Why this person is listed at all — the list is driven by
                      role, not by having an employment record. */}
                  <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {row.roles.length === 0 ? (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      ) : (
                        row.roles.map((role) => (
                          <Chip key={role} label={role} size="small" variant="outlined" />
                        ))
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    {row.employeeCode ? (
                      <Typography variant="body2" sx={{ letterSpacing: '0.03em' }}>
                        {row.employeeCode}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {row.qualification || row.specialisation ? (
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap title={row.qualification ?? undefined}>
                          {row.qualification ?? '—'}
                        </Typography>
                        {row.specialisation && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            component="div"
                          >
                            {row.specialisation}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      // Distinguishes "listed from their role, never filled in"
                      // from "has a record but left this blank".
                      <Typography variant="body2" color="text.disabled">
                        {row.hasProfile ? 'Not recorded' : 'No staff record yet'}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={row.experienceYears ? 'inherit' : 'text.disabled'}
                    >
                      {row.experienceYears} {row.experienceYears === 1 ? 'yr' : 'yrs'}
                    </Typography>
                  </TableCell>

                  {/* Clickable: allocation is the thing most often changed from
                      this table, so it gets a target rather than a menu trip. */}
                  <TableCell>
                    <Tooltip title="Manage allocations">
                      <Stack
                        direction="row"
                        gap={0.5}
                        flexWrap="wrap"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenAllocations(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') onOpenAllocations(row);
                        }}
                        sx={{ cursor: 'pointer', py: 0.5 }}
                      >
                        <Chip
                          label={`${row.subjects.length} subject${row.subjects.length === 1 ? '' : 's'}`}
                          size="small"
                          variant="outlined"
                          color={row.subjects.length ? 'primary' : 'default'}
                        />
                        {row.sections.length > 0 && (
                          <Chip
                            label={row.sections.map((section) => section.className).join(', ')}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Actions for ${row.firstName} ${row.lastName}`}
                      onClick={(event) => onOpenActions(row, event.currentTarget)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_event, next) => onPageChange(next)}
        onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
        sx={{ borderTop: '1px solid', borderColor: 'divider' }}
      />
    </Box>
  );
}
