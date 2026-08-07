import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  STATUS_COLORS,
  STATUS_LABELS,
  type AttendanceCounts,
  type AttendanceStatus,
} from '../types';

/** Below this, a percentage is worth flagging rather than merely reporting. */
const CONCERN_THRESHOLD = 75;

function Tile({ status, value }: { status: AttendanceStatus; value: number }) {
  return (
    <Box
      sx={{
        flex: '1 1 90px',
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette[STATUS_COLORS[status]].main, 0.1),
      }}
    >
      <Typography variant="h4" component="div" color={`${STATUS_COLORS[status]}.main`}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {STATUS_LABELS[status]}
      </Typography>
    </Box>
  );
}

/**
 * One month's tally, for a single student.
 *
 * The percentage counts LATE as attended — a child who arrived was at school —
 * which is why it can exceed the Present count alone.
 */
export function AttendanceSummary({ counts }: { counts: AttendanceCounts }) {
  const low = counts.percentage !== null && counts.percentage < CONCERN_THRESHOLD;

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack gap={2}>
        <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap">
          <Typography variant="h2" component="div" color={low ? 'error.main' : 'success.main'}>
            {counts.percentage === null ? '—' : `${counts.percentage}%`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {counts.marked === 0
              ? 'nothing marked this month'
              : `attended, across ${counts.marked} day${counts.marked === 1 ? '' : 's'} marked`}
          </Typography>
        </Stack>

        {counts.percentage !== null && (
          <LinearProgress
            variant="determinate"
            value={counts.percentage}
            color={low ? 'error' : 'success'}
            sx={{ height: 6, borderRadius: 3 }}
          />
        )}

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Tile status="PRESENT" value={counts.present} />
          <Tile status="ABSENT" value={counts.absent} />
          <Tile status="LEAVE" value={counts.leave} />
          <Tile status="LATE" value={counts.late} />
        </Stack>
      </Stack>
    </Paper>
  );
}
