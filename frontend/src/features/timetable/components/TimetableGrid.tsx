import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  DAY_FULL_LABELS,
  DAY_LABELS,
  type DayOfWeek,
  type Period,
  type TimetableEntry,
  type TimetableScope,
} from '../types';

interface TimetableGridProps {
  periods: Period[];
  days: DayOfWeek[];
  entries: TimetableEntry[];
  /** Whose week this is — a section's grid names teachers, a teacher's names classes. */
  scope: TimetableScope;
  canEdit: boolean;
  onSelectSlot: (day: DayOfWeek, period: Period) => void;
  onSelectEntry: (entry: TimetableEntry) => void;
}

/** Keyed by `day|periodId` — the pair that identifies a cell. */
const keyOf = (day: DayOfWeek, periodId: string) => `${day}|${periodId}`;

/** Every cell the same height, so the week reads as a grid rather than a list. */
const CELL_HEIGHT = 62;

/**
 * The week as a table: periods down the side, days across the top.
 *
 * A table rather than an absolutely-positioned calendar because this grid is
 * genuinely tabular — every column shares the same rows, since the period
 * ladder is school-wide. That also makes it readable by a screen reader and
 * printable without a second layout.
 */
export function TimetableGrid({
  periods,
  days,
  entries,
  scope,
  canEdit,
  onSelectSlot,
  onSelectEntry,
}: TimetableGridProps) {
  const byCell = new Map(entries.map((entry) => [keyOf(entry.day, entry.periodId), entry]));

  if (periods.length === 0) {
    return (
      <Stack alignItems="center" gap={1} sx={{ py: 8 }}>
        <Typography variant="subtitle2" color="text.secondary">
          The school day has no periods yet
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Define the period ladder first — every class shares it.
        </Typography>
      </Stack>
    );
  }

  return (
    <TableContainer>
      <Table
        size="small"
        sx={{
          tableLayout: 'fixed',
          minWidth: 820,
          '& .MuiTableCell-root': { borderColor: 'divider', px: 1 },
          '& .MuiTableCell-head': {
            backgroundColor: 'action.hover',
            fontWeight: 700,
            fontSize: '0.6875rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell width={132}>Period</TableCell>
            {days.map((day) => (
              <TableCell key={day} align="center" title={DAY_FULL_LABELS[day]}>
                {DAY_LABELS[day]}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {periods.map((period) => {
            // A break is one band across the week, not seven identical cells —
            // this is how a printed timetable shows lunch, and it stops the eye
            // reading an empty row as unfilled slots.
            if (period.isBreak) {
              return (
                <TableRow key={period.id}>
                  <TableCell sx={{ bgcolor: 'action.hover', py: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {period.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {period.startTime}–{period.endTime}
                    </Typography>
                  </TableCell>

                  <TableCell
                    colSpan={days.length}
                    align="center"
                    sx={{ bgcolor: 'action.disabledBackground', py: 1 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      {period.name}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            }

            return (
              <TableRow key={period.id}>
                <TableCell sx={{ bgcolor: 'action.hover', verticalAlign: 'middle' }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {period.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {period.startTime}–{period.endTime}
                  </Typography>
                </TableCell>

                {days.map((day) => {
                  const entry = byCell.get(keyOf(day, period.id));

                  if (!entry) {
                    return (
                      <TableCell
                        key={day}
                        align="center"
                        onClick={canEdit ? () => onSelectSlot(day, period) : undefined}
                        sx={{
                          height: CELL_HEIGHT,
                          cursor: canEdit ? 'pointer' : 'default',
                          color: 'text.disabled',
                          '&:hover': canEdit
                            ? { bgcolor: 'action.hover', color: 'primary.main' }
                            : undefined,
                        }}
                      >
                        {canEdit ? (
                          <AddIcon sx={{ fontSize: 16, opacity: 0.45 }} />
                        ) : (
                          <Typography variant="caption">—</Typography>
                        )}
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell
                      key={day}
                      onClick={canEdit ? () => onSelectEntry(entry) : undefined}
                      sx={{
                        height: CELL_HEIGHT,
                        verticalAlign: 'middle',
                        cursor: canEdit ? 'pointer' : 'default',
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                        borderLeft: '3px solid',
                        borderLeftColor: 'primary.main',
                        '&:hover': canEdit
                          ? { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14) }
                          : undefined,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap lineHeight={1.3}>
                          {entry.subjectName}
                        </Typography>
                        {/* A section's grid asks "who teaches this?"; a teacher's
                            asks "which class am I with?" */}
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {scope === 'section'
                            ? entry.teacherName
                            : `${entry.className} ${entry.sectionName}`}
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
