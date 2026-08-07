import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';

import { useClassesList } from '@/features/classes/hooks/useClasses';
import { AppDialog } from '@/shared/components';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import { useCreateExam, useUpdateExam } from '../hooks/useExams';
import { EXAM_TYPES, EXAM_TYPE_LABELS, type Exam, type ExamType } from '../types';

interface ExamFormDialogProps {
  open: boolean;
  /** Absent when setting a new exam. */
  exam?: Exam | null;
  onClose: () => void;
}

const CLASS_PARAMS = { page: 1, limit: MAX_PAGE_SIZE, sortBy: 'level', sortOrder: 'asc' } as const;

/**
 * Set or rename an exam. The schedule lives on its own page — an exam with no
 * papers is a perfectly good draft, and asking for both at once would make
 * creating one a bigger act than it is.
 */
export function ExamFormDialog({ open, exam, onClose }: ExamFormDialogProps) {
  const isEdit = Boolean(exam);
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const mutation = isEdit ? updateExam : createExam;

  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('MIDTERM');
  const [classId, setClassId] = useState('');
  const [instructions, setInstructions] = useState('');

  const { data: classes } = useClassesList(CLASS_PARAMS, open);
  const classItems = classes?.items ?? [];

  useEffect(() => {
    if (!open) return;
    setName(exam?.name ?? '');
    setType(exam?.type ?? 'MIDTERM');
    setClassId(exam?.classId ?? '');
    setInstructions(exam?.instructions ?? '');
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam]);

  const submit = () => {
    const payload = {
      name: name.trim(),
      type,
      classId,
      instructions: instructions.trim() || null,
    };

    if (exam) {
      updateExam.mutate({ id: exam.id, input: payload }, { onSuccess: onClose });
    } else {
      createExam.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit exam' : 'Set an exam'}
      subtitle={isEdit ? exam?.className : 'It starts as a draft — you add the papers next.'}
      icon={AssignmentOutlinedIcon}
      maxWidth="sm"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Create draft'}
      confirmDisabled={name.trim().length < 2 || !classId}
      onConfirm={submit}
    >
      <TextField
        label="Name"
        placeholder="Midterm 2026"
        value={name}
        required
        autoFocus
        disabled={mutation.isPending}
        onChange={(event) => setName(event.target.value)}
        helperText="Unique within the class."
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          select
          label="Type"
          value={type}
          disabled={mutation.isPending}
          onChange={(event) => setType(event.target.value as ExamType)}
          sx={{ flex: 1 }}
        >
          {EXAM_TYPES.map((option) => (
            <MenuItem key={option} value={option}>
              {EXAM_TYPE_LABELS[option]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Class"
          value={classId}
          required
          disabled={mutation.isPending}
          onChange={(event) => setClassId(event.target.value)}
          sx={{ flex: 1 }}
          helperText="Every section of the class sits the same papers."
        >
          {classItems.map((schoolClass) => (
            <MenuItem key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <TextField
        label="Instructions"
        placeholder="Bring your own instruments."
        value={instructions}
        multiline
        minRows={2}
        disabled={mutation.isPending}
        onChange={(event) => setInstructions(event.target.value)}
        helperText="Shown with the schedule once published. Optional."
      />
    </AppDialog>
  );
}
