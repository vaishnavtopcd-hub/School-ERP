import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

import { useSubjectsList } from '@/features/subjects/hooks/useSubjects';
import { useTeachersList } from '@/features/teachers/hooks/useTeachers';
import { AppDialog } from '@/shared/components';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import { useCreateEntry, useDeleteEntry, useUpdateEntry } from '../hooks/useTimetable';
import { DAY_FULL_LABELS, type DayOfWeek, type Period, type TimetableEntry } from '../types';

interface AssignLessonDialogProps {
  open: boolean;
  /** The slot being filled: which day, which period, which section. */
  slot: { day: DayOfWeek; period: Period } | null;
  sectionId: string;
  classId: string;
  /** Set when an existing lesson was clicked rather than an empty cell. */
  entry: TimetableEntry | null;
  onClose: () => void;
}

/**
 * Assign a subject and a teacher to one slot.
 *
 * Both clash rules are the API's to enforce — this shows the refusal rather
 * than trying to predict it. A client-side guess would have to hold every other
 * section's grid in memory to be right, and would still be stale.
 */
export function AssignLessonDialog({
  open,
  slot,
  sectionId,
  classId,
  entry,
  onClose,
}: AssignLessonDialogProps) {
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  // Subjects belong to a class, so only that class's are offered — the API
  // refuses any other, and offering them would be an invitation to be refused.
  const { data: subjects } = useSubjectsList(
    { page: 1, limit: MAX_PAGE_SIZE, classId, sortBy: 'name', sortOrder: 'asc' },
    open && Boolean(classId),
  );

  const { data: teachers } = useTeachersList(
    { page: 1, limit: MAX_PAGE_SIZE, sortBy: 'firstName', sortOrder: 'asc' },
    open,
  );

  useEffect(() => {
    if (!open) return;
    setSubjectId(entry?.subjectId ?? '');
    setTeacherId(entry?.teacherId ?? '');
    createEntry.reset();
    updateEntry.reset();
    deleteEntry.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;
  const error = createEntry.error ?? updateEntry.error ?? deleteEntry.error;

  const subjectItems = subjects?.items ?? [];

  // Whoever teaches this subject elsewhere is the likeliest answer, so they are
  // offered first rather than buried in an alphabetical list of all staff.
  const suggestedTeacherId = subjectItems.find((subject) => subject.id === subjectId)?.teacher?.id;

  if (!slot) return null;

  const submit = () => {
    if (!subjectId || !teacherId) return;

    if (entry) {
      updateEntry.mutate({ id: entry.id, input: { subjectId, teacherId } }, { onSuccess: onClose });
    } else {
      createEntry.mutate(
        { day: slot.day, periodId: slot.period.id, sectionId, subjectId, teacherId },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={entry ? 'Edit lesson' : 'Assign lesson'}
      subtitle={`${DAY_FULL_LABELS[slot.day]} · ${slot.period.name} · ${slot.period.startTime}–${slot.period.endTime}`}
      icon={EventNoteOutlinedIcon}
      maxWidth="sm"
      error={error}
      isPending={pending}
      pendingLabel="Saving…"
      confirmLabel={entry ? 'Save lesson' : 'Assign'}
      confirmDisabled={!subjectId || !teacherId}
      onConfirm={submit}
    >
      <TextField
        select
        label="Subject"
        value={subjectId}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          setSubjectId(next);
          // Prefill the subject's own teacher, but only into an empty field —
          // never overwrite a choice already made.
          const owner = subjectItems.find((subject) => subject.id === next)?.teacher?.id;
          if (owner && !teacherId) setTeacherId(owner);
        }}
        helperText={
          subjectItems.length === 0
            ? 'This class has no subjects yet — add them under Subjects.'
            : ' '
        }
      >
        {subjectItems.map((subject) => (
          <MenuItem key={subject.id} value={subject.id}>
            <ListItemText primary={subject.name} secondary={subject.code} />
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Teacher"
        value={teacherId}
        disabled={pending}
        onChange={(event) => setTeacherId(event.target.value)}
        helperText={
          suggestedTeacherId && suggestedTeacherId !== teacherId
            ? 'This subject is normally taken by someone else.'
            : ' '
        }
      >
        {(teachers?.items ?? []).map((teacher) => (
          <MenuItem key={teacher.id} value={teacher.id}>
            <ListItemText
              primary={`${teacher.firstName} ${teacher.lastName}`}
              secondary={teacher.id === suggestedTeacherId ? 'Teaches this subject' : undefined}
            />
          </MenuItem>
        ))}
      </TextField>

      <Alert severity="info" variant="outlined">
        <Typography variant="caption">
          A teacher cannot be in two places at once, and a section cannot be taught two subjects at
          once. Either clash is refused with the lesson that is in the way.
        </Typography>
      </Alert>

      {entry && (
        <Stack direction="row">
          <Button
            color="error"
            disabled={pending}
            onClick={() => deleteEntry.mutate(entry.id, { onSuccess: onClose })}
          >
            Clear this slot
          </Button>
        </Stack>
      )}
    </AppDialog>
  );
}
