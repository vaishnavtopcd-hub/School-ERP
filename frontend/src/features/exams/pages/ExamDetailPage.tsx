import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';
import { formatDateOnly } from '@/shared/utils';

import { AddPaperDialog } from '../components/AddPaperDialog';
import { ExamFormDialog } from '../components/ExamFormDialog';
import { ExamScheduleTable } from '../components/ExamScheduleTable';
import {
  useArchiveExam,
  useDeleteExam,
  useExam,
  usePublishExam,
  useRemoveExamPaper,
} from '../hooks/useExams';
import {
  EXAM_STATUS_COLORS,
  EXAM_STATUS_HINTS,
  EXAM_STATUS_LABELS,
  EXAM_TYPE_LABELS,
  type ExamPaper,
} from '../types';

type Confirmation = 'publish' | 'archive' | 'delete' | { paper: ExamPaper } | null;

/**
 * One exam: its schedule, and the two decisions that move it through its life.
 *
 * Publishing and archiving are confirmed rather than immediate — the first
 * announces a schedule to the whole school and freezes it, the second cannot be
 * undone.
 */
export default function ExamDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const { data: exam, isLoading, error } = useExam(id);

  const publishExam = usePublishExam();
  const archiveExam = useArchiveExam();
  const deleteExam = useDeleteExam();
  const removePaper = useRemoveExamPaper();

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation>(null);

  const loadError = error instanceof ApiError ? error : null;
  const actionError = [
    publishExam.error,
    archiveExam.error,
    deleteExam.error,
    removePaper.error,
  ].find((value): value is ApiError => value instanceof ApiError);

  const isPending =
    publishExam.isPending || archiveExam.isPending || deleteExam.isPending || removePaper.isPending;

  if (isLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (loadError || !exam) {
    return (
      <Box>
        <PageHeader breadcrumb="Academics · Examinations" title="Exam" />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate(ROUTES.exams.list)}>
              Back to exams
            </Button>
          }
        >
          {loadError?.message ?? 'That exam could not be found.'}
        </Alert>
      </Box>
    );
  }

  const isDraft = exam.status === 'DRAFT';
  const canEdit = hasPermission('exam:update') && isDraft;
  const closeConfirm = () => {
    setConfirm(null);
    publishExam.reset();
    archiveExam.reset();
    deleteExam.reset();
  };

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics · Examinations"
        title={exam.name}
        subtitle={`${EXAM_TYPE_LABELS[exam.type]} · ${exam.className}${
          exam.academicYearName ? ` · ${exam.academicYearName}` : ''
        }`}
        meta={
          <Chip
            label={EXAM_STATUS_LABELS[exam.status]}
            color={EXAM_STATUS_COLORS[exam.status]}
            size="small"
          />
        }
        actions={
          <>
            <Button
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(ROUTES.exams.list)}
            >
              Exams
            </Button>

            {exam.status === 'PUBLISHED' && (
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={() => window.print()}
              >
                Print
              </Button>
            )}

            {canEdit && (
              <Button
                color="inherit"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
            )}

            {isDraft && hasPermission('exam:publish') && (
              <Button
                variant="contained"
                startIcon={<CampaignOutlinedIcon />}
                disabled={exam.paperCount === 0 || isPending}
                onClick={() => setConfirm('publish')}
              >
                Publish
              </Button>
            )}

            {exam.status === 'PUBLISHED' && hasPermission('exam:archive') && (
              <Button
                variant="outlined"
                startIcon={<ArchiveOutlinedIcon />}
                disabled={isPending}
                onClick={() => setConfirm('archive')}
              >
                Archive
              </Button>
            )}
          </>
        }
      />

      {actionError && (
        <Alert severity="error" className="mb-4">
          {actionError.message}
        </Alert>
      )}

      <Stack gap={2.5}>
        {/* What this state means, said rather than implied — the difference
            between a draft and an announcement is the whole module. */}
        <Alert severity={exam.status === 'DRAFT' ? 'info' : 'success'} variant="outlined">
          <Typography variant="caption">
            {EXAM_STATUS_HINTS[exam.status]}
            {exam.publishedAt && ` Announced on ${formatDateOnly(exam.publishedAt)}.`}
          </Typography>
        </Alert>

        {exam.instructions && (
          <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="overline" color="text.secondary">
              Instructions
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
              {exam.instructions}
            </Typography>
          </Paper>
        )}

        <Paper elevation={0} variant="outlined">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1.5}
            sx={{ p: 2 }}
          >
            <Box>
              <Typography variant="overline" color="text.secondary">
                Schedule
              </Typography>
              {exam.startsOn && (
                <Typography variant="caption" color="text.secondary" component="div">
                  {formatDateOnly(exam.startsOn)}
                  {exam.endsOn && exam.endsOn !== exam.startsOn
                    ? ` – ${formatDateOnly(exam.endsOn)}`
                    : ''}
                </Typography>
              )}
            </Box>

            {canEdit && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
                Add paper
              </Button>
            )}
          </Stack>

          <Divider />

          <ExamScheduleTable
            papers={exam.papers}
            isPending={isPending}
            onRemove={canEdit ? (paper) => setConfirm({ paper }) : undefined}
          />
        </Paper>

        {isDraft && hasPermission('exam:delete') && (
          <Box>
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              disabled={isPending}
              onClick={() => setConfirm('delete')}
            >
              Delete draft
            </Button>
          </Box>
        )}
      </Stack>

      <ExamFormDialog open={editOpen} exam={exam} onClose={() => setEditOpen(false)} />
      <AddPaperDialog open={addOpen} exam={exam} onClose={() => setAddOpen(false)} />

      <ConfirmActionDialog
        open={confirm === 'publish'}
        title="Publish this exam"
        confirmLabel="Publish"
        isPending={publishExam.isPending}
        error={publishExam.error}
        body={
          <>
            Announce <strong>{exam.name}</strong> to {exam.className}? Its {exam.paperCount} paper
            {exam.paperCount === 1 ? '' : 's'} become visible to teaching staff and on each
            student&rsquo;s profile, and <strong>the schedule is frozen</strong> — a date that
            changes after the school has been told is worse than no date.
          </>
        }
        onConfirm={() => publishExam.mutate(exam.id, { onSuccess: closeConfirm })}
        onClose={closeConfirm}
      />

      <ConfirmActionDialog
        open={confirm === 'archive'}
        title="Archive this exam"
        confirmLabel="Archive"
        destructive
        isPending={archiveExam.isPending}
        error={archiveExam.error}
        body={
          <>
            Close <strong>{exam.name}</strong> for good? It stays on the record and stays readable,
            but <strong>cannot be reopened</strong> — a superseding exam is a new one.
          </>
        }
        onConfirm={() => archiveExam.mutate(exam.id, { onSuccess: closeConfirm })}
        onClose={closeConfirm}
      />

      <ConfirmActionDialog
        open={confirm === 'delete'}
        title="Delete this draft"
        confirmLabel="Delete"
        destructive
        isPending={deleteExam.isPending}
        error={deleteExam.error}
        body={
          <>
            Delete <strong>{exam.name}</strong> and its schedule? Nobody outside the office has seen
            it, so nothing is lost that anyone was told about.
          </>
        }
        onConfirm={() =>
          deleteExam.mutate(exam.id, {
            onSuccess: () => navigate(ROUTES.exams.list, { replace: true }),
          })
        }
        onClose={closeConfirm}
      />

      <ConfirmActionDialog
        open={typeof confirm === 'object' && confirm !== null}
        title="Remove this paper"
        confirmLabel="Remove"
        destructive
        isPending={removePaper.isPending}
        error={removePaper.error}
        body={
          typeof confirm === 'object' && confirm !== null ? (
            <>
              Take <strong>{confirm.paper.subjectName}</strong> off the schedule?
            </>
          ) : null
        }
        onConfirm={() => {
          if (typeof confirm !== 'object' || confirm === null) return;
          removePaper.mutate(
            { id: exam.id, paperId: confirm.paper.id },
            { onSuccess: closeConfirm },
          );
        }}
        onClose={closeConfirm}
      />
    </Box>
  );
}
