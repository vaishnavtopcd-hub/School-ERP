import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';

import { useAttendanceOverview } from '../hooks/useAttendance';
import { today } from '../types';

/**
 * The classes, and how far each one's register has got today.
 *
 * A school takes attendance section by section, so the first question is which
 * sections are still outstanding — not which student. Picking one opens its
 * register.
 */
export default function AttendancePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(today());

  const { data, isFetching, error } = useAttendanceOverview(date);

  const loadError = error instanceof ApiError ? error : null;
  const sections = data?.sections ?? [];

  const done = sections.filter((row) => row.isComplete).length;
  const withStudents = sections.filter((row) => row.students > 0).length;

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Attendance"
        subtitle="Pick a class to take its register or read its month."
        meta={
          withStudents > 0 && (
            <Chip
              size="small"
              color={done === withStudents ? 'success' : 'default'}
              variant="outlined"
              label={`${done} of ${withStudents} taken`}
            />
          )
        }
        actions={
          <TextField
            size="small"
            type="date"
            label="Date"
            value={date}
            inputProps={{ max: today() }}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => setDate(event.target.value)}
            sx={{ minWidth: 180 }}
          />
        }
      />

      {loadError && (
        <Alert severity="error" className="mb-4">
          {loadError.message}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <Box sx={{ position: 'relative' }}>
          {isFetching && (
            <LinearProgress
              sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 2, height: 2 }}
            />
          )}

          <TableContainer>
            <Table
              sx={{
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
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Class</TableCell>
                  <TableCell width={110} align="right">
                    Students
                  </TableCell>
                  {/* The date is on the column, not only in the picker above:
                      "Not taken" is meaningless without saying not taken when,
                      and the picker is easy to miss. */}
                  <TableCell width={200}>
                    Register · {new Date(`${date}T00:00:00Z`).toUTCString().slice(5, 16)}
                  </TableCell>
                  <TableCell width={130} align="right">
                    Away
                  </TableCell>
                  <TableCell width={56} />
                </TableRow>
              </TableHead>

              <TableBody>
                {sections.length === 0 && !isFetching && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ borderBottom: 0 }}>
                      <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                        <FactCheckOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                        <Typography variant="subtitle2" color="text.secondary">
                          No classes yet
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Add a class with at least one section before taking attendance.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}

                {sections.map((row) => {
                  const empty = row.students === 0;

                  return (
                    <TableRow
                      key={row.sectionId}
                      hover
                      onClick={() => navigate(ROUTES.attendance.section(row.sectionId))}
                      sx={{ cursor: 'pointer', '& > .MuiTableCell-root': { py: 1.5 } }}
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                          <Typography variant="body2" fontWeight={600}>
                            {row.className} — {row.sectionName}
                          </Typography>
                          {/* Retired, but still holding students, so it is here
                              rather than hidden — with the reason on it. */}
                          {!row.isActive && (
                            <Tooltip title="This section is retired but still has students in it. Move them, or reactivate it under Classes.">
                              <Chip label="Inactive" size="small" variant="outlined" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={empty ? 'text.disabled' : 'text.primary'}
                        >
                          {row.students}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {empty ? (
                          <Typography variant="caption" color="text.disabled">
                            No students
                          </Typography>
                        ) : (
                          <Stack direction="row" alignItems="center" gap={0.75}>
                            {row.isComplete ? (
                              <CheckCircleIcon sx={{ fontSize: 17, color: 'success.main' }} />
                            ) : (
                              <RadioButtonUncheckedIcon
                                sx={{ fontSize: 17, color: 'text.disabled' }}
                              />
                            )}
                            <Typography
                              variant="body2"
                              color={row.isComplete ? 'success.main' : 'text.secondary'}
                            >
                              {row.isComplete
                                ? 'Taken'
                                : row.marked === 0
                                  ? 'Not taken'
                                  : `${row.marked} of ${row.students}`}
                            </Typography>
                          </Stack>
                        )}
                      </TableCell>

                      {/* The number anyone actually wants off this screen: how
                          many children are not in class today. */}
                      <TableCell align="right">
                        {row.marked === 0 ? (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        ) : (
                          <Chip
                            size="small"
                            variant="outlined"
                            color={row.away > 0 ? 'warning' : 'success'}
                            label={row.away === 0 ? 'All in' : `${row.away} away`}
                          />
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <ChevronRightIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 2 }}>
          Progress is shown for {date}. Open a class to mark another day or read the month.
        </Typography>
      </Paper>
    </Box>
  );
}
