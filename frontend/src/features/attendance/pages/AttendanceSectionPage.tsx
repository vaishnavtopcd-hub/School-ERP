import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';

import { AttendanceMatrix, type DayChange } from '../components/AttendanceMatrix';
import { useClearAttendanceDay, useMarkAttendance, useMonthlyReport } from '../hooks/useAttendance';
import { currentMonth } from '../types';

/**
 * One section's register, as a wall chart: students down, days across.
 *
 * Marking and reading are the same screen. A teacher clicks the children who
 * are away and saves; every other child in a touched column is recorded present
 * — which is what taking a register means, and what makes it two clicks rather
 * than thirty.
 */
export default function AttendanceSectionPage() {
  const { sectionId = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [month, setMonth] = useState(currentMonth());

  const { data: report, isFetching, error } = useMonthlyReport(sectionId, month);
  const markAttendance = useMarkAttendance();
  const clearDay = useClearAttendanceDay();

  const canMark = hasPermission('attendance:create');
  const canClear = hasPermission('attendance:delete');
  const loadError = [error, markAttendance.error, clearDay.error].find(
    (value): value is ApiError => value instanceof ApiError,
  );

  /**
   * One day, one request — which is also one register. Reporting whether it
   * landed lets the column settle rather than sit there looking unsaved.
   */
  const saveDay = async (change: DayChange): Promise<boolean> => {
    try {
      await markAttendance.mutateAsync({
        sectionId,
        date: change.date,
        records: change.records,
      });
      return true;
    } catch {
      // Surfaced by the mutation above.
      return false;
    }
  };

  const removeDay = async (date: string): Promise<boolean> => {
    try {
      await clearDay.mutateAsync({ sectionId, date });
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics · Attendance"
        title={report ? `${report.className} — ${report.sectionName}` : 'Attendance'}
        subtitle="Click a student's day to mark them away. Everyone else that day is present."
        actions={
          <>
            <Button
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(ROUTES.attendance.list)}
            >
              Classes
            </Button>
            <Button
              variant="outlined"
              startIcon={<PrintOutlinedIcon />}
              disabled={!report}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </>
        }
      />

      {loadError && (
        <Alert severity="error" className="mb-4">
          {loadError.message}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1.5}
          alignItems={{ sm: 'center' }}
          sx={{ p: 2 }}
        >
          <TextField
            size="small"
            type="month"
            label="Month"
            value={month}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => setMonth(event.target.value)}
            sx={{ minWidth: 180 }}
          />

          <Box sx={{ flex: 1 }} />

          {report && report.dates.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {report.dates.length} day{report.dates.length === 1 ? '' : 's'} taken this month
            </Typography>
          )}
        </Stack>

        <Divider />

        <Box sx={{ position: 'relative' }}>
          {(isFetching || markAttendance.isPending || clearDay.isPending) && (
            <LinearProgress
              sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 5, height: 2 }}
            />
          )}

          {report && (
            <AttendanceMatrix
              report={report}
              month={month}
              canMark={canMark}
              canClear={canClear}
              isPending={markAttendance.isPending || clearDay.isPending}
              onSaveDay={saveDay}
              onClearDay={removeDay}
            />
          )}
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Clicking a cell cycles Absent → Leave → Late → Present. Click a day’s heading to save, fill,
        or remove it. Greyed columns are in the future. The percentage counts late as attended — a
        child who arrived was at school.
      </Typography>
    </Box>
  );
}
