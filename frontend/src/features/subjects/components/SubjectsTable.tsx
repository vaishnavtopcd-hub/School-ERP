import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { Subject } from '../types';

const COLUMN_COUNT = 6;

/**
 * Table chrome, mirroring the DataGrid styling used on the Users page so a
 * hand-rolled table and a grid read as the same component.
 */
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

interface SubjectsTableProps {
  rows: Subject[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  /** Distinguishes "nothing matches the search" from "nothing exists yet". */
  filtered: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenActions: (subject: Subject, anchor: HTMLElement) => void;
}

export function SubjectsTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  filtered,
  onPageChange,
  onPageSizeChange,
  onOpenActions,
}: SubjectsTableProps) {
  return (
    <Box>
      {/* Overlaid rather than stacked above the table: an in-flow progress bar
          shifts every row down each time a query refetches. */}
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
                <TableCell>Subject</TableCell>
                <TableCell width={150}>Class</TableCell>
                <TableCell width={220}>Teacher</TableCell>
                <TableCell width={110} align="right">
                  Credits
                </TableCell>
                <TableCell width={120}>Status</TableCell>
                <TableCell width={60} align="right" />
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} sx={{ borderBottom: 0 }}>
                    <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                      <MenuBookOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                      <Typography variant="subtitle2" color="text.secondary">
                        {filtered ? 'No matching subjects' : 'No subjects yet'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {filtered
                          ? 'Try a different search term or clear the filters.'
                          : 'Add a subject to start building the curriculum.'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => (
                <TableRow key={row.id} hover sx={{ '& > .MuiTableCell-root': { py: 1.25 } }}>
                  {/* Code and name are one identity, so they share a cell —
                      the code alone is meaningless to most readers. */}
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          flexShrink: 0,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          color: row.isActive ? 'primary.main' : 'text.disabled',
                          bgcolor: (theme) =>
                            alpha(
                              row.isActive
                                ? theme.palette.primary.main
                                : theme.palette.text.disabled,
                              0.12,
                            ),
                        }}
                      >
                        <MenuBookOutlinedIcon sx={{ fontSize: 17 }} />
                      </Box>

                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {row.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          component="div"
                          sx={{ letterSpacing: '0.03em' }}
                        >
                          {row.code}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Chip label={row.class.name} size="small" variant="outlined" />
                  </TableCell>

                  <TableCell>
                    {row.teacher ? (
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {row.teacher.firstName} {row.teacher.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {row.teacher.email}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        Unassigned
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" color={row.credits ? 'inherit' : 'text.disabled'}>
                      {row.credits}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={row.isActive ? 'Active' : 'Inactive'}
                      color={row.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Actions for ${row.name}`}
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
