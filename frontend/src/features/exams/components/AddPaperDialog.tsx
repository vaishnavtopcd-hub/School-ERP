import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';

import { useSubjectsList } from '@/features/subjects/hooks/useSubjects';
import { AppDialog } from '@/shared/components';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import { useAddExamPaper } from '../hooks/useExams';
import type { Exam } from '../types';

interface AddPaperDialogProps {
  open: boolean;
  exam: Exam;
  onClose: () => void;
}

/** Schedule one subject's paper. Defaults chosen so most papers are three fields. */
export function AddPaperDialog({ open, exam, onClose }: AddPaperDialogProps) {
  const addPaper = useAddExamPaper();

  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('12:30');
  const [maxMarks, setMaxMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('35');
  const [venue, setVenue] = useState('');

  // Only this class's subjects — the API refuses any other, and offering them
  // would be an invitation to be refused.
  const { data: subjects } = useSubjectsList(
    { page: 1, limit: MAX_PAGE_SIZE, classId: exam.classId, sortBy: 'name', sortOrder: 'asc' },
    open,
  );

  const scheduled = new Set(exam.papers.map((paper) => paper.subjectId));
  const available = (subjects?.items ?? []).filter((subject) => !scheduled.has(subject.id));

  useEffect(() => {
    if (!open) return;
    setSubjectId('');
    // The last paper's date is the likeliest next one — exams run in a block.
    setDate(exam.papers[exam.papers.length - 1]?.date ?? '');
    setVenue('');
    addPaper.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const marksInvalid = Number(passMarks) > Number(maxMarks) || !maxMarks || Number(maxMarks) < 1;
  const timesInvalid = Boolean(startTime && endTime) && endTime <= startTime;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Schedule a paper"
      subtitle={`${exam.name} · ${exam.className}`}
      icon={EventNoteOutlinedIcon}
      maxWidth="sm"
      error={addPaper.error}
      isPending={addPaper.isPending}
      pendingLabel="Adding…"
      confirmLabel="Add paper"
      confirmDisabled={!subjectId || !date || marksInvalid || timesInvalid}
      onConfirm={() =>
        addPaper.mutate(
          {
            id: exam.id,
            input: {
              subjectId,
              date,
              startTime,
              endTime,
              maxMarks: Number(maxMarks),
              passMarks: Number(passMarks),
              venue: venue.trim() || null,
            },
          },
          { onSuccess: onClose },
        )
      }
    >
      <TextField
        select
        label="Subject"
        value={subjectId}
        required
        disabled={addPaper.isPending}
        onChange={(event) => setSubjectId(event.target.value)}
        helperText={
          available.length === 0
            ? 'Every subject of this class already has a paper, or the class has none.'
            : 'Each subject is examined once per exam.'
        }
      >
        {available.map((subject) => (
          <MenuItem key={subject.id} value={subject.id}>
            <ListItemText primary={subject.name} secondary={subject.code} />
          </MenuItem>
        ))}
      </TextField>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          label="Date"
          type="date"
          value={date}
          required
          InputLabelProps={{ shrink: true }}
          disabled={addPaper.isPending}
          onChange={(event) => setDate(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Start"
          type="time"
          value={startTime}
          InputLabelProps={{ shrink: true }}
          disabled={addPaper.isPending}
          onChange={(event) => setStartTime(event.target.value)}
          sx={{ width: 130 }}
        />
        <TextField
          label="End"
          type="time"
          value={endTime}
          error={timesInvalid}
          helperText={timesInvalid ? 'Must be after the start.' : ' '}
          InputLabelProps={{ shrink: true }}
          disabled={addPaper.isPending}
          onChange={(event) => setEndTime(event.target.value)}
          sx={{ width: 130 }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          label="Maximum marks"
          type="number"
          value={maxMarks}
          disabled={addPaper.isPending}
          onChange={(event) => setMaxMarks(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Pass marks"
          type="number"
          value={passMarks}
          error={marksInvalid}
          helperText={marksInvalid ? 'Cannot exceed the maximum.' : ' '}
          disabled={addPaper.isPending}
          onChange={(event) => setPassMarks(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Venue"
          placeholder="Hall B"
          value={venue}
          disabled={addPaper.isPending}
          onChange={(event) => setVenue(event.target.value)}
          sx={{ flex: 1 }}
        />
      </Stack>
    </AppDialog>
  );
}
