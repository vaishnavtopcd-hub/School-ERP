import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  EXAM_TYPE_LABELS,
  ExamScheduleTable,
  useExamsList,
  type ListExamsParams,
} from '@/features/exams';
import { ApiError } from '@/shared/api';
import { MAX_PAGE_SIZE } from '@/shared/constants';
import { formatDateOnly } from '@/shared/utils';

interface ExamsTabProps {
  classId: string | null;
  className: string | null;
}

/**
 * The exams this student's class sits.
 *
 * Published only. A draft is the office's working copy — showing it here would
 * announce a schedule that has not been announced, which is the one thing the
 * publish step exists to prevent.
 */
export function ExamsTab({ classId, className }: ExamsTabProps) {
  const params: ListExamsParams = {
    page: 1,
    limit: MAX_PAGE_SIZE,
    classId: classId ?? undefined,
    status: 'PUBLISHED',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const { data, isLoading, error } = useExamsList(params, Boolean(classId));

  const loadError = error instanceof ApiError ? error : null;
  const exams = data?.items ?? [];

  if (!classId) {
    return (
      <Paper elevation={0} variant="outlined" sx={{ p: 5 }}>
        <Stack alignItems="center" gap={1}>
          <AssignmentOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
          <Typography variant="subtitle2" color="text.secondary">
            Not placed in a class
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
            Exams are set per class, so this student has none until they are placed.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack gap={2.5}>
      {loadError && <Alert severity="error">{loadError.message}</Alert>}

      {exams.length === 0 && (
        <Paper elevation={0} variant="outlined" sx={{ p: 5 }}>
          <Stack alignItems="center" gap={1}>
            <AssignmentOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
            <Typography variant="subtitle2" color="text.secondary">
              No exams announced
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
              Nothing has been published for {className ?? 'this class'} yet. Drafts stay with the
              office until they are.
            </Typography>
          </Stack>
        </Paper>
      )}

      {exams.map((exam) => (
        <Paper key={exam.id} elevation={0} variant="outlined">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            gap={1}
            sx={{ p: 2 }}
          >
            <Box>
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                <Typography variant="subtitle2" fontWeight={700}>
                  {exam.name}
                </Typography>
                <Chip label={EXAM_TYPE_LABELS[exam.type]} size="small" variant="outlined" />
              </Stack>
              {exam.startsOn && (
                <Typography variant="caption" color="text.secondary" component="div">
                  {formatDateOnly(exam.startsOn)}
                  {exam.endsOn && exam.endsOn !== exam.startsOn
                    ? ` – ${formatDateOnly(exam.endsOn)}`
                    : ''}
                </Typography>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              {exam.paperCount} paper{exam.paperCount === 1 ? '' : 's'}
            </Typography>
          </Stack>

          {exam.instructions && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 2 }}>
                {exam.instructions}
              </Typography>
            </>
          )}

          <Divider />

          {/* Read-only: no `onRemove`, so the student's copy of the schedule
              cannot be edited from here. */}
          <ExamScheduleTable papers={exam.papers} />
        </Paper>
      ))}
    </Stack>
  );
}
