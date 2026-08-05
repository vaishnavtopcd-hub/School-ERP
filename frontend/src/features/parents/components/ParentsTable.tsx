import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
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

import type { Parent } from '../types';

const COLUMN_COUNT = 6;

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

interface ParentsTableProps {
  rows: Parent[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  filtered: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenActions: (parent: Parent, anchor: HTMLElement) => void;
  onOpenStudents: (parent: Parent) => void;
}

export function ParentsTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  filtered,
  onPageChange,
  onPageSizeChange,
  onOpenActions,
  onOpenStudents,
}: ParentsTableProps) {
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
                <TableCell>Guardian</TableCell>
                <TableCell width={180}>Contact</TableCell>
                <TableCell width={200}>Address</TableCell>
                <TableCell width={200}>Emergency contact</TableCell>
                <TableCell width={210}>Students</TableCell>
                <TableCell width={60} align="right" />
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} sx={{ borderBottom: 0 }}>
                    <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                      <ContactPhoneOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                      <Typography variant="subtitle2" color="text.secondary">
                        {filtered ? 'No matching guardians' : 'No guardians yet'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {filtered
                          ? 'Try a different search term or clear the filters.'
                          : 'Add a guardian, then link them to their children.'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => {
                const address = [row.city, row.state].filter(Boolean).join(', ');

                return (
                  <TableRow key={row.id} hover sx={{ '& > .MuiTableCell-root': { py: 1.25 } }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Avatar
                          src={row.avatarUrl ?? undefined}
                          sx={{
                            width: 34,
                            height: 34,
                            fontSize: '0.75rem',
                            bgcolor: 'secondary.main',
                            opacity: row.status === 'ACTIVE' ? 1 : 0.5,
                          }}
                        >
                          {initials(row)}
                        </Avatar>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {row.firstName} {row.lastName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            component="div"
                          >
                            {row.occupation ?? row.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {row.phone ?? '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {row.email}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      {row.addressLine1 || address ? (
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap title={row.addressLine1 ?? undefined}>
                            {row.addressLine1 ?? '—'}
                          </Typography>
                          {address && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              component="div"
                            >
                              {address}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          Not recorded
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      {row.emergencyContactName ? (
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            {row.emergencyContactName}
                            {row.emergencyContactRelation && (
                              <Typography component="span" variant="caption" color="text.disabled">
                                {' '}
                                ({row.emergencyContactRelation})
                              </Typography>
                            )}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            component="div"
                          >
                            {row.emergencyContactPhone ?? 'No number'}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          Not recorded
                        </Typography>
                      )}
                    </TableCell>

                    {/* Clickable: linking children is the thing most often
                        changed from this table. */}
                    <TableCell>
                      <Tooltip title="Manage students">
                        <Stack
                          direction="row"
                          gap={0.5}
                          flexWrap="wrap"
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenStudents(row)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') onOpenStudents(row);
                          }}
                          sx={{ cursor: 'pointer', py: 0.5 }}
                        >
                          {row.students.length === 0 ? (
                            <Chip label="None linked" size="small" variant="outlined" />
                          ) : (
                            row.students
                              .slice(0, 2)
                              .map((student) => (
                                <Chip
                                  key={student.id}
                                  label={`${student.firstName}${student.isPrimaryContact ? ' ★' : ''}`}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              ))
                          )}
                          {row.students.length > 2 && (
                            <Chip label={`+${row.students.length - 2}`} size="small" />
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
                );
              })}
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
