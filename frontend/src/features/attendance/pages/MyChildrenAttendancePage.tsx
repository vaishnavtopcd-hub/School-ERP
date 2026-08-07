import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { formatDateOnly } from '@/shared/utils';

import { AttendanceSummary } from '../components/AttendanceSummary';
import { useMyChildrenAttendance } from '../hooks/useAttendance';
import { STATUS_COLORS, STATUS_LABELS, currentMonth, type StudentAttendance } from '../types';

/**
 * One child's month: the tally, then the days that were not ordinary.
 *
 * Present days are omitted from the list on purpose — a parent opens this to
 * find out what went wrong, and thirty rows saying "Present" bury the two that
 * do not.
 */
function ChildPanel({ child }: { child: StudentAttendance }) {
  const notable = child.days.filter((day) => day.status !== 'PRESENT');

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack gap={2}>
        <Box>
          <Typography variant="h4" component="h3">
            {child.firstName} {child.lastName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {child.admissionNo}
            {child.className
              ? ` · ${child.className}${child.sectionName ? ` — ${child.sectionName}` : ''}`
              : ''}
          </Typography>
        </Box>

        <AttendanceSummary counts={child.counts} />

        {child.counts.marked > 0 && (
          <>
            <Divider />
            {notable.length === 0 ? (
              <Typography variant="body2" color="success.main">
                Present every day marked this month.
              </Typography>
            ) : (
              <Stack gap={1}>
                <Typography variant="overline" color="text.secondary">
                  Days to note
                </Typography>
                {notable.map((day) => (
                  <Stack
                    key={day.date}
                    direction="row"
                    alignItems="center"
                    gap={1}
                    flexWrap="wrap"
                    sx={{ minWidth: 0 }}
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
          </>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * A guardian's own children.
 *
 * The API takes no student id — it derives the children from who is asking —
 * so there is nothing on this page that could be pointed at somebody else's.
 */
export default function MyChildrenAttendancePage() {
  const [month, setMonth] = useState(currentMonth());

  const { data: children, isLoading, error } = useMyChildrenAttendance(month);

  const loadError = error instanceof ApiError ? error : null;

  return (
    <Box>
      <PageHeader
        breadcrumb="My family"
        title="Attendance"
        subtitle="How your children have been marked at school."
        actions={
          <TextField
            size="small"
            type="month"
            label="Month"
            value={month}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => setMonth(event.target.value)}
            sx={{ minWidth: 170 }}
          />
        }
      />

      {loadError && (
        <Alert severity="error" className="mb-4">
          {loadError.message}
        </Alert>
      )}

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      )}

      {children && children.length === 0 && (
        <Paper elevation={0} variant="outlined" sx={{ p: 5 }}>
          <Stack alignItems="center" gap={1}>
            <FamilyRestroomOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
            <Typography variant="subtitle2" color="text.secondary">
              No children linked to your account
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
              The school records which guardians belong to which students. Ask the office to link
              you if this looks wrong.
            </Typography>
          </Stack>
        </Paper>
      )}

      <Stack gap={2.5}>
        {children?.map((child) => (
          <ChildPanel key={child.studentId} child={child} />
        ))}
      </Stack>
    </Box>
  );
}
