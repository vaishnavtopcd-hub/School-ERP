import MedicalInformationOutlinedIcon from '@mui/icons-material/MedicalInformationOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
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
import { alpha } from '@mui/material/styles';

import { formatDateOnly } from '@/shared/utils';

import {
  BLOOD_GROUP_LABELS,
  GENDER_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type Student,
} from '../types';

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

interface StudentsTableProps {
  rows: Student[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  filtered: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenActions: (student: Student, anchor: HTMLElement) => void;
  /** The row itself opens the record — the list's main job is getting you there. */
  onOpenStudent: (student: Student) => void;
}

export function StudentsTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  filtered,
  onPageChange,
  onPageSizeChange,
  onOpenActions,
  onOpenStudent,
}: StudentsTableProps) {
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
                <TableCell>Student</TableCell>
                <TableCell width={150}>Class</TableCell>
                <TableCell width={130}>Date of birth</TableCell>
                <TableCell width={230}>Guardians</TableCell>
                <TableCell width={130}>Status</TableCell>
                <TableCell width={60} align="right" />
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} sx={{ borderBottom: 0 }}>
                    <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                      <SchoolOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                      <Typography variant="subtitle2" color="text.secondary">
                        {filtered ? 'No matching students' : 'No students yet'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {filtered
                          ? 'Try a different search term or clear the filters.'
                          : 'Enrol a student to start building the register.'}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => onOpenStudent(row)}
                  sx={{ '& > .MuiTableCell-root': { py: 1.25 }, cursor: 'pointer' }}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      {/* The photo when there is one; the school mark when
                          there is not, rather than an empty circle. */}
                      <Avatar
                        src={row.photoUrl ?? undefined}
                        variant="rounded"
                        sx={{
                          width: 32,
                          height: 32,
                          flexShrink: 0,
                          borderRadius: 2,
                          color: row.status === 'ACTIVE' ? 'primary.main' : 'text.disabled',
                          bgcolor: (theme) =>
                            alpha(
                              row.status === 'ACTIVE'
                                ? theme.palette.primary.main
                                : theme.palette.text.disabled,
                              0.12,
                            ),
                          opacity: row.status === 'ACTIVE' ? 1 : 0.6,
                        }}
                      >
                        <SchoolOutlinedIcon sx={{ fontSize: 17 }} />
                      </Avatar>

                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {row.firstName} {row.lastName}
                          </Typography>
                          {/* Flagged in the register, not just buried in the
                              form: whoever handles an incident reads this list. */}
                          {row.medicalNotes && (
                            <Tooltip title={row.medicalNotes}>
                              <MedicalInformationOutlinedIcon
                                sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }}
                              />
                            </Tooltip>
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          component="div"
                          sx={{ letterSpacing: '0.03em' }}
                        >
                          {row.admissionNo}
                          {row.gender ? ` · ${GENDER_LABELS[row.gender]}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    {row.className ? (
                      <Chip
                        label={
                          row.sectionName ? `${row.className} — ${row.sectionName}` : row.className
                        }
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        Not placed
                      </Typography>
                    )}
                  </TableCell>

                  {/* Blood group rides with the date of birth: both are read off
                      the record in the same breath, and neither earns a column. */}
                  <TableCell>
                    {row.dateOfBirth ? (
                      <Typography variant="body2">{formatDateOnly(row.dateOfBirth)}</Typography>
                    ) : (
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    )}
                    {row.bloodGroup && (
                      <Typography variant="caption" color="text.secondary" component="div">
                        {BLOOD_GROUP_LABELS[row.bloodGroup]}
                      </Typography>
                    )}
                  </TableCell>

                  {/* The primary contact is who the office calls first, so it
                      leads and is marked. */}
                  <TableCell>
                    {row.guardians.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        None linked
                      </Typography>
                    ) : (
                      <Stack gap={0.25}>
                        {row.guardians.slice(0, 2).map((guardian) => (
                          <Stack
                            key={guardian.id}
                            direction="row"
                            alignItems="center"
                            gap={0.5}
                            sx={{ minWidth: 0 }}
                          >
                            <Typography variant="caption" noWrap>
                              {guardian.firstName} {guardian.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" noWrap>
                              ({guardian.relationship.toLowerCase()})
                            </Typography>
                            {guardian.isPrimaryContact && (
                              <Tooltip title="Primary contact">
                                <Box
                                  component="span"
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: 'success.main',
                                    flexShrink: 0,
                                  }}
                                />
                              </Tooltip>
                            )}
                          </Stack>
                        ))}
                        {row.guardians.length > 2 && (
                          <Typography variant="caption" color="text.disabled">
                            +{row.guardians.length - 2} more
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={STATUS_LABELS[row.status]}
                      color={STATUS_COLORS[row.status]}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={`Actions for ${row.firstName} ${row.lastName}`}
                      onClick={(event) => {
                        // Otherwise the row beneath opens the record as well.
                        event.stopPropagation();
                        onOpenActions(row, event.currentTarget);
                      }}
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
