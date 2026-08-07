import CheckIcon from '@mui/icons-material/Check';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

import {
  ATTENDANCE_STATUSES,
  STATUS_COLORS,
  STATUS_INITIALS,
  STATUS_LABELS,
  today,
  type AttendanceStatus,
  type MonthlyReport,
} from '../types';

/** One day's worth of marks, ready for the API. */
export interface DayChange {
  date: string;
  records: Array<{ studentId: string; status: AttendanceStatus }>;
}

interface AttendanceMatrixProps {
  report: MonthlyReport;
  /** `YYYY-MM` — the columns come from this, not from what has been marked. */
  month: string;
  canMark: boolean;
  canClear: boolean;
  isPending: boolean;
  /** Resolves true when the day was written, so the column can settle. */
  onSaveDay: (change: DayChange) => Promise<boolean>;
  onClearDay: (date: string) => Promise<boolean>;
}

/**
 * Clicking a cell walks this list.
 *
 * Absent comes first because that is what a teacher is doing when they touch a
 * cell at all: everyone unmarked is treated as present on save, so the only
 * reason to click is that someone is not.
 */
const CYCLE: AttendanceStatus[] = ['ABSENT', 'LEAVE', 'LATE', 'PRESENT'];

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Every day of a `YYYY-MM`, as `YYYY-MM-DD`. */
function daysOfMonth(month: string): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
}

const cellKey = (studentId: string, date: string) => `${studentId}|${date}`;

/**
 * The register as a wall chart: students down the side, days across the top.
 *
 * Each column is a day, and a day is what gets saved — clicking its heading is
 * how you save it, clear it, or fill it in. There is no page-level save button
 * on purpose: "save everything I have touched anywhere in the month" is not a
 * thing a teacher means, and a single button made two separate registers look
 * like one action.
 */
export function AttendanceMatrix({
  report,
  month,
  canMark,
  canClear,
  isPending,
  onSaveDay,
  onClearDay,
}: AttendanceMatrixProps) {
  /** Overrides on top of what is stored, keyed `studentId|date`. */
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [menu, setMenu] = useState<{ anchor: HTMLElement; date: string } | null>(null);

  // A different month or section is a different chart; anything half-marked
  // belonged to the old one.
  useEffect(() => {
    setDraft({});
  }, [report.sectionId, month]);

  const dates = useMemo(() => daysOfMonth(month), [month]);
  const currentDay = today();

  const stored = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const student of report.students) {
      for (const [date, status] of Object.entries(student.byDate)) {
        map.set(cellKey(student.studentId, date), status);
      }
    }
    return map;
  }, [report]);

  const takenDates = useMemo(() => new Set(report.dates), [report.dates]);

  const valueAt = (studentId: string, date: string): AttendanceStatus | null =>
    draft[cellKey(studentId, date)] ?? stored.get(cellKey(studentId, date)) ?? null;

  const editedOn = (date: string) =>
    report.students.some((student) => draft[cellKey(student.studentId, date)] !== undefined);

  const cycle = (studentId: string, date: string) => {
    const current = valueAt(studentId, date);
    const next = current === null ? CYCLE[0] : CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setDraft((previous) => ({ ...previous, [cellKey(studentId, date)]: next }));
  };

  /** Drops a day's overrides — after it is written, cleared, or abandoned. */
  const forgetDay = (date: string) =>
    setDraft((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([key]) => !key.endsWith(`|${date}`))),
    );

  /** Students with no mark for that day — the ones `fill` decides. */
  const unmarkedOn = (date: string) =>
    report.students.filter((student) => valueAt(student.studentId, date) === null);

  /**
   * A saved column is written whole: the students marked as marked, and
   * everybody else as `fill`.
   *
   * `fill` is chosen at save time rather than assumed. Present is the usual
   * answer — you mark the absentees and the rest were there — but a day the
   * school was shut, or a trip half the class was on, is the same act with the
   * opposite default, and guessing would silently record thirty children as
   * present at an event they never attended.
   */
  const saveDay = async (date: string, fill: AttendanceStatus) => {
    const written = await onSaveDay({
      date,
      records: report.students.map((student) => ({
        studentId: student.studentId,
        status: valueAt(student.studentId, date) ?? fill,
      })),
    });

    if (written) forgetDay(date);
  };

  const clearDay = async (date: string) => {
    if (await onClearDay(date)) forgetDay(date);
  };

  const unsavedDays = dates.filter((date) => editedOn(date));

  if (report.students.length === 0) {
    return (
      <Stack alignItems="center" gap={1} sx={{ py: 8 }}>
        <Typography variant="subtitle2" color="text.secondary">
          No students in this section
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Enrol students into it before taking the register.
        </Typography>
      </Stack>
    );
  }

  const menuDate = menu?.date ?? '';
  const menuEdited = menuDate ? editedOn(menuDate) : false;
  const menuTaken = menuDate ? takenDates.has(menuDate) : false;
  const menuUnmarked = menuDate ? unmarkedOn(menuDate).length : 0;
  const closeMenu = () => setMenu(null);

  return (
    <Box>
      <TableContainer sx={{ maxHeight: '68vh' }}>
        <Table
          size="small"
          stickyHeader
          sx={{
            borderCollapse: 'separate',
            '& .MuiTableCell-root': { borderColor: 'divider', px: 0.5, py: 0.5 },
            '& .MuiTableCell-head': {
              backgroundColor: 'background.paper',
              fontWeight: 700,
              fontSize: '0.6875rem',
              color: 'text.secondary',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 4,
                  minWidth: 190,
                  bgcolor: 'background.paper',
                }}
              >
                Student
              </TableCell>

              {dates.map((date) => {
                const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
                const isToday = date === currentDay;
                const edited = editedOn(date);
                const taken = takenDates.has(date);
                const future = date > currentDay;

                return (
                  <TableCell
                    key={date}
                    align="center"
                    onClick={
                      canMark && !future
                        ? (event) => setMenu({ anchor: event.currentTarget, date })
                        : undefined
                    }
                    sx={{
                      minWidth: 30,
                      cursor: canMark && !future ? 'pointer' : 'default',
                      color: isToday ? 'primary.main' : undefined,
                      // Unsaved beats taken: the column needs attention more
                      // than it needs praise.
                      bgcolor: edited
                        ? (theme) => alpha(theme.palette.warning.main, 0.16)
                        : undefined,
                      '&:hover': canMark && !future ? { bgcolor: 'action.hover' } : undefined,
                    }}
                  >
                    <Box sx={{ fontSize: '0.6875rem', lineHeight: 1.2 }}>
                      {Number(date.slice(8, 10))}
                    </Box>
                    {/* Weekday under the number: a teacher looks for "last
                        Tuesday", not for "the 12th". */}
                    <Box sx={{ fontSize: '0.5625rem', opacity: 0.6 }}>
                      {WEEKDAY_INITIALS[weekday]}
                    </Box>
                    {/* One glyph of state per column, so the header answers
                        "which days still need me?" at a glance. */}
                    <Box sx={{ height: 10, fontSize: '0.5625rem', lineHeight: 1 }}>
                      {edited ? '●' : taken ? '✓' : ''}
                    </Box>
                  </TableCell>
                );
              })}

              <TableCell align="right" sx={{ minWidth: 60 }}>
                %
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {report.students.map((student, index) => (
              <TableRow key={student.studentId} hover>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    bgcolor: 'background.paper',
                    minWidth: 190,
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ width: 18, textAlign: 'right', flexShrink: 0 }}
                    >
                      {index + 1}
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {student.firstName} {student.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {student.admissionNo}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>

                {dates.map((date) => {
                  const status = valueAt(student.studentId, date);
                  const edited = draft[cellKey(student.studentId, date)] !== undefined;
                  // The API refuses a future date, so those cells are inert
                  // rather than clickable-then-rejected.
                  const future = date > currentDay;
                  const clickable = canMark && !future && !isPending;

                  return (
                    <TableCell
                      key={date}
                      align="center"
                      onClick={clickable ? () => cycle(student.studentId, date) : undefined}
                      sx={{
                        cursor: clickable ? 'pointer' : 'default',
                        bgcolor: future ? 'action.disabledBackground' : undefined,
                        ...(edited ? { outline: '2px solid', outlineColor: 'warning.main' } : {}),
                        '&:hover': clickable ? { bgcolor: 'action.hover' } : undefined,
                      }}
                    >
                      {status ? (
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-grid',
                            placeItems: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: 1,
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            color: `${STATUS_COLORS[status]}.main`,
                            bgcolor: (theme) =>
                              alpha(theme.palette[STATUS_COLORS[status]].main, 0.16),
                          }}
                        >
                          {STATUS_INITIALS[status]}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          ·
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}

                <TableCell align="right">
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color={
                      student.counts.percentage !== null && student.counts.percentage < 75
                        ? 'error.main'
                        : 'text.primary'
                    }
                  >
                    {student.counts.percentage === null ? '—' : `${student.counts.percentage}%`}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* One save row per day with unsaved marks, sticky at the bottom. A
          teacher usually has exactly one; more than one means an older day was
          corrected too, and each is still its own register. */}
      {canMark && unsavedDays.length > 0 && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 3,
            borderTop: 2,
            borderColor: 'warning.main',
            bgcolor: 'background.paper',
          }}
        >
          {unsavedDays.map((date) => {
            const unmarked = unmarkedOn(date).length;
            const marked = report.students.length - unmarked;

            return (
              <Stack
                key={date}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ md: 'center' }}
                justifyContent="space-between"
                gap={1.5}
                sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {new Date(`${date}T00:00:00Z`).toUTCString().slice(0, 16)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {marked} marked
                    {unmarked > 0
                      ? ` · ${unmarked} unmarked — choose what they were`
                      : ' · everyone accounted for'}
                  </Typography>
                </Box>

                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Button
                    size="small"
                    color="inherit"
                    disabled={isPending}
                    onClick={() => forgetDay(date)}
                  >
                    Discard
                  </Button>

                  {/* With nobody unmarked the two buttons would do the same
                      thing, so it collapses to one. */}
                  {unmarked === 0 ? (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={isPending}
                      onClick={() => void saveDay(date, 'PRESENT')}
                    >
                      {isPending ? 'Saving…' : 'Save day'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={isPending}
                        onClick={() => void saveDay(date, 'ABSENT')}
                      >
                        Save · rest absent
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={isPending}
                        onClick={() => void saveDay(date, 'PRESENT')}
                      >
                        {isPending ? 'Saving…' : 'Save · rest present'}
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>
            );
          })}
        </Box>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          {ATTENDANCE_STATUSES.map((status) => (
            <Tooltip key={status} title={STATUS_LABELS[status]}>
              <Chip
                size="small"
                variant="outlined"
                color={STATUS_COLORS[status]}
                label={`${STATUS_INITIALS[status]} ${STATUS_LABELS[status]}`}
              />
            </Tooltip>
          ))}
        </Stack>

        {canMark && unsavedDays.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Click a cell to mark someone away — a save bar appears for that day.
          </Typography>
        )}
      </Stack>

      {/* The day's own menu. Saving, filling, and clearing are all acts on one
          column, so they live on the column rather than on the page. */}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={closeMenu}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {menuDate}
          </Typography>
        </Box>
        <Divider />

        {/* The same two saves as the bar below, for a day being taken from
            scratch with nobody marked away — there is nothing to edit, so no
            save bar has appeared yet. */}
        <MenuItem
          disabled={isPending}
          onClick={() => {
            closeMenu();
            void saveDay(menuDate, 'PRESENT');
          }}
        >
          <ListItemIcon>
            <DoneAllIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText
            primary="Save · rest present"
            secondary={`${menuUnmarked} unmarked recorded present`}
          />
        </MenuItem>

        <MenuItem
          disabled={isPending}
          onClick={() => {
            closeMenu();
            void saveDay(menuDate, 'ABSENT');
          }}
        >
          <ListItemIcon>
            <CheckIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Save · rest absent"
            secondary={`${menuUnmarked} unmarked recorded absent`}
          />
        </MenuItem>

        {menuEdited && (
          <MenuItem
            disabled={isPending}
            onClick={() => {
              closeMenu();
              forgetDay(menuDate);
            }}
          >
            <ListItemIcon>
              <UndoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Discard changes" secondary="Back to what is stored" />
          </MenuItem>
        )}

        {canClear &&
          menuTaken && [
            <Divider key="divider" />,
            <MenuItem
              key="clear"
              disabled={isPending}
              onClick={() => {
                closeMenu();
                void clearDay(menuDate);
              }}
            >
              <ListItemIcon>
                <DeleteOutlineIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Remove this day"
                secondary="Erases the register — for a day marked by mistake"
                primaryTypographyProps={{ color: 'error.main' }}
              />
            </MenuItem>,
          ]}
      </Menu>
    </Box>
  );
}
