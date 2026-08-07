import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { useClassesList } from '@/features/classes/hooks/useClasses';
import { useSubjectsList } from '@/features/subjects/hooks/useSubjects';
import { AppDialog } from '@/shared/components';
import { ApiError } from '@/shared/api';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import {
  useAllocateSection,
  useAllocateSubject,
  useDeallocateSection,
  useDeallocateSubject,
  useTeacher,
} from '../hooks/useTeachers';
import type { Teacher } from '../types';

interface TeacherAllocationsDialogProps {
  open: boolean;
  teacher: Teacher | null;
  onClose: () => void;
}

const SUBJECT_PARAMS = {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'code' as const,
  sortOrder: 'asc' as const,
};
const CLASS_PARAMS = {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'level' as const,
  sortOrder: 'asc' as const,
};

/** One allocation row: what it is, and a way to take it away. */
function AllocationRow({
  primary,
  secondary,
  onRemove,
  disabled,
  removeLabel,
}: {
  primary: string;
  secondary: string;
  onRemove: () => void;
  disabled: boolean;
  removeLabel: string;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {primary}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {secondary}
        </Typography>
      </Box>

      <Tooltip title={removeLabel}>
        <span>
          <IconButton size="small" aria-label={removeLabel} disabled={disabled} onClick={onRemove}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

/**
 * Subject and class-teacher allocation.
 *
 * Both are the same fields the Subjects and Classes pages write, so nothing is
 * duplicated — the API delegates to those modules, which is what keeps rules
 * like "one section per academic year" enforced from whichever page you use.
 */
export function TeacherAllocationsDialog({
  open,
  teacher,
  onClose,
}: TeacherAllocationsDialogProps) {
  // Refetched live: every allocation returns the updated teacher, and this is
  // what shows the result without closing the dialog.
  const { data: current } = useTeacher(open && teacher ? teacher.id : null);
  const view = current ?? teacher;

  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const { data: subjects } = useSubjectsList(SUBJECT_PARAMS, open);
  const { data: classes } = useClassesList(CLASS_PARAMS, open);

  const allocateSubject = useAllocateSubject();
  const deallocateSubject = useDeallocateSubject();
  const allocateSection = useAllocateSection();
  const deallocateSection = useDeallocateSection();

  const pending =
    allocateSubject.isPending ||
    deallocateSubject.isPending ||
    allocateSection.isPending ||
    deallocateSection.isPending;

  const error = [allocateSubject, deallocateSubject, allocateSection, deallocateSection]
    .map((mutation) => mutation.error)
    .find((value): value is ApiError => value instanceof ApiError);

  if (!view) return null;

  const allocatedSubjectIds = new Set(view.subjects.map((subject) => subject.id));
  const availableSubjects = (subjects?.items ?? []).filter(
    (subject) => !allocatedSubjectIds.has(subject.id),
  );

  // Sections come from the classes list, which already embeds them.
  const allocatedSectionIds = new Set(view.sections.map((section) => section.id));
  const availableSections = (classes?.items ?? []).flatMap((schoolClass) =>
    schoolClass.sections
      .filter((section) => !allocatedSectionIds.has(section.id))
      .map((section) => ({
        id: section.id,
        label: `${schoolClass.name} — ${section.name}`,
        taken: Boolean(section.classTeacher),
        takenBy: section.classTeacher
          ? `${section.classTeacher.firstName} ${section.classTeacher.lastName}`
          : null,
      })),
  );

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Allocations"
      subtitle={`${view.firstName} ${view.lastName}`}
      icon={SchoolOutlinedIcon}
      maxWidth="sm"
      confirmLabel="Done"
      cancelLabel="Close"
      onConfirm={onClose}
    >
      {error && <Alert severity="error">{error.message}</Alert>}

      {/* --- Subjects --------------------------------------------------- */}
      <Box>
        <Typography variant="overline" color="text.secondary">
          Subjects ({view.subjects.length})
        </Typography>

        {view.subjects.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No subjects allocated.
          </Typography>
        ) : (
          <Stack sx={{ mb: 1 }}>
            {view.subjects.map((subject) => (
              <AllocationRow
                key={subject.id}
                primary={`${subject.name} (${subject.code})`}
                secondary={`${subject.className} · ${subject.credits} credit${subject.credits === 1 ? '' : 's'}`}
                removeLabel={`Unassign ${subject.name}`}
                disabled={pending}
                onRemove={() => deallocateSubject.mutate({ id: view.id, subjectId: subject.id })}
              />
            ))}
          </Stack>
        )}

        <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 1 }}>
          <TextField
            select
            size="small"
            label="Add a subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            sx={{ flex: 1 }}
            helperText={
              availableSubjects.length === 0 ? 'Every subject is already allocated here.' : ' '
            }
          >
            {availableSubjects.map((subject) => (
              <MenuItem key={subject.id} value={subject.id}>
                {subject.code} — {subject.name}
                {subject.teacher ? ` (currently ${subject.teacher.firstName})` : ''}
              </MenuItem>
            ))}
          </TextField>

          <Button
            startIcon={<AddIcon />}
            disabled={!subjectId || pending}
            onClick={() =>
              allocateSubject.mutate(
                { id: view.id, subjectId },
                { onSuccess: () => setSubjectId('') },
              )
            }
            sx={{ mt: 0.5 }}
          >
            Assign
          </Button>
        </Stack>
      </Box>

      {/* --- Class teacher of ------------------------------------------- */}
      <Box>
        <Typography variant="overline" color="text.secondary">
          Class teacher of ({view.sections.length})
        </Typography>

        {view.sections.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Not a class teacher.
          </Typography>
        ) : (
          <Stack sx={{ mb: 1 }}>
            {view.sections.map((section) => (
              <AllocationRow
                key={section.id}
                primary={`${section.className} — ${section.name}`}
                secondary="Class teacher"
                removeLabel={`Remove from ${section.className} ${section.name}`}
                disabled={pending}
                onRemove={() => deallocateSection.mutate({ id: view.id, sectionId: section.id })}
              />
            ))}
          </Stack>
        )}

        <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 1 }}>
          <TextField
            select
            size="small"
            label="Assign a section"
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
            sx={{ flex: 1 }}
            helperText="A teacher may hold only one section per academic year."
          >
            {availableSections.map((section) => (
              <MenuItem key={section.id} value={section.id}>
                {section.label}
                {section.taken && (
                  <Chip label={section.takenBy ?? 'Taken'} size="small" sx={{ ml: 1 }} />
                )}
              </MenuItem>
            ))}
          </TextField>

          <Button
            startIcon={<AddIcon />}
            disabled={!sectionId || pending}
            onClick={() =>
              allocateSection.mutate(
                { id: view.id, sectionId },
                { onSuccess: () => setSectionId('') },
              )
            }
            sx={{ mt: 0.5 }}
          >
            Assign
          </Button>
        </Stack>
      </Box>
    </AppDialog>
  );
}
