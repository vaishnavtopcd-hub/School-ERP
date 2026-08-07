import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { useStudentsList } from '@/features/students/hooks/useStudents';
import { ApiError } from '@/shared/api';
import { AppDialog } from '@/shared/components';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import { useLinkStudent, useParent, useUnlinkStudent, useUpdateLink } from '../hooks/useParents';
import { type GuardianRelationship, type Parent } from '../types';
import { GuardianLinkPicker } from './GuardianLinkPicker';
import { GuardianLinkRow } from './GuardianLinkRow';

interface ParentStudentsDialogProps {
  open: boolean;
  parent: Parent | null;
  onClose: () => void;
}

const STUDENT_PARAMS = {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'admissionNo' as const,
  sortOrder: 'asc' as const,
};

/**
 * Which students this guardian is responsible for, and how.
 *
 * The relationship lives on the link rather than on either side, because the
 * same person is a FATHER to one student and nothing to another — so it is set
 * here, per child, not on the guardian record.
 */
export function ParentStudentsDialog({ open, parent, onClose }: ParentStudentsDialogProps) {
  // Refetched live: every link returns the updated guardian, and this is what
  // shows the result without closing the dialog.
  const { data: current } = useParent(open && parent ? parent.id : null);
  const view = current ?? parent;

  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationship>('FATHER');

  const { data: students, isError: studentsFailed } = useStudentsList(STUDENT_PARAMS, open);

  const linkStudent = useLinkStudent();
  const unlinkStudent = useUnlinkStudent();
  const updateLink = useUpdateLink();

  const pending = linkStudent.isPending || unlinkStudent.isPending || updateLink.isPending;

  const error = [linkStudent, unlinkStudent, updateLink]
    .map((mutation) => mutation.error)
    .find((value): value is ApiError => value instanceof ApiError);

  if (!view) return null;

  const linkedIds = new Set(view.students.map((student) => student.id));
  const available = (students?.items ?? []).filter((student) => !linkedIds.has(student.id));

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Students"
      subtitle={`${view.firstName} ${view.lastName}`}
      icon={FamilyRestroomOutlinedIcon}
      maxWidth="sm"
      confirmLabel="Done"
      cancelLabel="Close"
      onConfirm={onClose}
    >
      {error && <Alert severity="error">{error.message}</Alert>}

      {studentsFailed && (
        <Alert severity="warning">
          Could not load the student list, so the picker below is empty. Close and reopen this
          dialog to try again.
        </Alert>
      )}

      <Box>
        <Typography variant="overline" color="text.secondary">
          Linked students ({view.students.length})
        </Typography>

        {view.students.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No students linked yet.
          </Typography>
        ) : (
          <Stack sx={{ mb: 1 }}>
            {view.students.map((student) => (
              <GuardianLinkRow
                key={student.id}
                title={`${student.firstName} ${student.lastName}`}
                subtitle={`${student.admissionNo}${
                  student.className
                    ? ` · ${student.className}${student.sectionName ? ` — ${student.sectionName}` : ''}`
                    : ' · not placed'
                }`}
                relationship={student.relationship}
                isPrimaryContact={student.isPrimaryContact}
                onMakePrimary={() =>
                  updateLink.mutate({
                    id: view.id,
                    studentId: student.id,
                    isPrimaryContact: true,
                  })
                }
                onRemove={() => unlinkStudent.mutate({ id: view.id, studentId: student.id })}
                removeLabel="Unlink"
                disabled={pending}
              />
            ))}
          </Stack>
        )}
      </Box>

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
        onAdd={() =>
          linkStudent.mutate(
            { id: view.id, studentId, relationship },
            { onSuccess: () => setStudentId('') },
          )
        }
        addLabel="Link"
        emptyText="Every student is already linked, or none exist yet."
        disabled={pending}
      />
    </AppDialog>
  );
}
