import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import {
  AttendanceSummary,
  STATUS_COLORS,
  STATUS_LABELS,
  currentMonth,
  useStudentAttendance,
} from '@/features/attendance';
import { ApiError } from '@/shared/api';
import { formatDateOnly } from '@/shared/utils';

/**
 * One student's month.
 *
 * Present days are left out of the list: the tally above already counts them,
 * and the reason anyone opens this tab is the days that were not ordinary.
 */
export function AttendanceTab({ studentId }: { studentId: string }) {
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, error } = useStudentAttendance(studentId, month);

  const loadError = error instanceof ApiError ? error : null;
  const notable = data?.days.filter((day) => day.status !== 'PRESENT') ?? [];

  return (
    <Stack gap={2.5}>
      <Stack direction="row" justifyContent="flex-end">
        <TextField
          size="small"
          type="month"
          label="Month"
          value={month}
          InputLabelProps={{ shrink: true }}
          onChange={(event) => setMonth(event.target.value)}
          sx={{ minWidth: 170 }}
        />
      </Stack>

      {loadError && <Alert severity="error">{loadError.message}</Alert>}

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}

      {data && (
        <>
          <AttendanceSummary counts={data.counts} />

          <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Typography variant="overline" color="text.secondary">
              Days to note
            </Typography>

            <Box sx={{ mt: 1 }}>
              {data.counts.marked === 0 ? (
                <Typography variant="body2" color="text.disabled">
                  Nothing marked this month.
                </Typography>
              ) : notable.length === 0 ? (
                <Typography variant="body2" color="success.main">
                  Present every day marked this month.
                </Typography>
              ) : (
                <Stack gap={1}>
                  {notable.map((day) => (
                    <Stack
                      key={day.date}
                      direction="row"
                      alignItems="center"
                      gap={1}
                      flexWrap="wrap"
                    >
                      <Typography variant="body2" sx={{ minWidth: 120 }}>
                        {formatDateOnly(day.date)}
                      </Typography>
                      <Chip
                        label={STATUS_LABELS[day.status]}
                        size="small"
                        color={STATUS_COLORS[day.status]}
                        variant="outlined"
                      />
                      {day.remarks && (
                        <Typography variant="caption" color="text.secondary">
                          {day.remarks}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Stack>
  );
}
