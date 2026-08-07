import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { useStudentsList } from '@/features/students/hooks/useStudents';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import type { GuardianRelationship } from '../types';
import { GuardianLinkPicker } from './GuardianLinkPicker';
import { GuardianLinkRow } from './GuardianLinkRow';

/**
 * A link the guardian does not have yet.
 *
 * `label` is carried along so a staged row renders without holding on to the
 * whole student list — the picker is the only part that needs it.
 */
export interface StagedLink {
  studentId: string;
  label: string;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
}

interface StudentLinksFieldProps {
  value: StagedLink[];
  onChange: (next: StagedLink[]) => void;
  /** Loads the student list only while the dialog is open. */
  enabled: boolean;
  disabled?: boolean;
}

const STUDENT_PARAMS = {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'admissionNo' as const,
  sortOrder: 'asc' as const,
};

/**
 * Which students a guardian is responsible for, chosen before that guardian
 * exists.
 *
 * The links cannot travel with the guardian — `POST /parents` has no field for
 * them, and the join table needs a parent id. So they are staged here and
 * written by the caller once the guardian has been created.
 */
export function StudentLinksField({
  value,
  onChange,
  enabled,
  disabled = false,
}: StudentLinksFieldProps) {
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationship>('FATHER');

  // Surfaced below: a failed list is otherwise indistinguishable from a school
  // with no students, which is what made the 400 on this request invisible.
  const { data: students, isError } = useStudentsList(STUDENT_PARAMS, enabled);

  const staged = new Set(value.map((link) => link.studentId));
  const available = (students?.items ?? []).filter((student) => !staged.has(student.id));

  const add = () => {
    const student = available.find((candidate) => candidate.id === studentId);
    if (!student) return;

    onChange([
      ...value,
      {
        studentId: student.id,
        label: `${student.admissionNo} — ${student.firstName} ${student.lastName}`,
        relationship,
        // The first one added is the default first call; it can be moved.
        isPrimaryContact: value.length === 0,
      },
    ]);
    setStudentId('');
  };

  // At most one primary per student, the same rule the API enforces — so making
  // one primary demotes the others rather than refusing.
  const makePrimary = (id: string) =>
    onChange(value.map((link) => ({ ...link, isPrimaryContact: link.studentId === id })));

  return (
    // Owns its spacing rather than borrowing the dialog's: this sits inside a
    // panel in the add form, where nothing else supplies a gap.
    <Stack gap={2}>
      {isError && (
        <Alert severity="warning">
          Could not load the student list. Close and reopen this form to try again.
        </Alert>
      )}

      {value.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No students added yet.
        </Typography>
      ) : (
        // Capped so a guardian with several children cannot push the picker
        // below the fold.
        <Stack sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {value.map((link) => (
            <GuardianLinkRow
              key={link.studentId}
              title={link.label}
              relationship={link.relationship}
              isPrimaryContact={link.isPrimaryContact}
              onMakePrimary={() => makePrimary(link.studentId)}
              onRemove={() => onChange(value.filter((row) => row.studentId !== link.studentId))}
              removeLabel="Remove"
              disabled={disabled}
            />
          ))}
        </Stack>
      )}

      <GuardianLinkPicker
        options={available.map((student) => ({
          id: student.id,
          label: `${student.admissionNo} — ${student.firstName} ${student.lastName}`,
        }))}
        optionLabel="Student"
        selectedId={studentId}
        onSelect={setStudentId}
        relationship={relationship}
        onRelationshipChange={setRelationship}
        onAdd={add}
        addLabel="Add"
        emptyText={
          value.length > 0
            ? 'Every student is already on this guardian.'
            : 'No students to link yet — you can add them later.'
        }
        disabled={disabled}
      />
    </Stack>
  );
}
