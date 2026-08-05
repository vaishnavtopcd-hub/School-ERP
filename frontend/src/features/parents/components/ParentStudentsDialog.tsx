import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
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

import { useStudentsList } from '@/features/students/hooks/useStudents';
import { ApiError } from '@/shared/api';
import { AppDialog } from '@/shared/components';

import { useLinkStudent, useParent, useUnlinkStudent, useUpdateLink } from '../hooks/useParents';
import {
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  type GuardianRelationship,
  type Parent,
} from '../types';

interface ParentStudentsDialogProps {
  open: boolean;
  parent: Parent | null;
  onClose: () => void;
}

const STUDENT_PARAMS = {
  page: 1,
  limit: 200,
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

  const { data: students } = useStudentsList(STUDENT_PARAMS, open);

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
              <Stack
                key={student.id}
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
                  <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {student.firstName} {student.lastName}
                    </Typography>
                    <Chip
                      label={RELATIONSHIP_LABELS[student.relationship]}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {student.admissionNo}
                    {student.className
                      ? ` · ${student.className}${student.sectionName ? ` — ${student.sectionName}` : ''}`
                      : ' · not placed'}
                  </Typography>
                </Box>

                {/* One primary contact per student; setting this demotes
                    whoever previously held it. */}
                <Tooltip
                  title={
                    student.isPrimaryContact
                      ? 'Primary contact'
                      : 'Make primary contact for this student'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      disabled={pending || student.isPrimaryContact}
                      aria-label={`Make primary contact for ${student.firstName}`}
                      onClick={() =>
                        updateLink.mutate({
                          id: view.id,
                          studentId: student.id,
                          isPrimaryContact: true,
                        })
                      }
                    >
                      {student.isPrimaryContact ? (
                        <StarIcon fontSize="small" color="success" />
                      ) : (
                        <StarBorderIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Unlink">
                  <span>
                    <IconButton
                      size="small"
                      disabled={pending}
                      aria-label={`Unlink ${student.firstName}`}
                      onClick={() => unlinkStudent.mutate({ id: view.id, studentId: student.id })}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="flex-start">
        <TextField
          select
          size="small"
          label="Student"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          sx={{ flex: 1 }}
          helperText={
            available.length === 0 ? 'Every student is already linked, or none exist yet.' : ' '
          }
        >
          {available.map((student) => (
            <MenuItem key={student.id} value={student.id}>
              {student.admissionNo} — {student.firstName} {student.lastName}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Relationship"
          value={relationship}
          onChange={(event) => setRelationship(event.target.value as GuardianRelationship)}
          sx={{ minWidth: 150 }}
          helperText=" "
        >
          {RELATIONSHIPS.map((value) => (
            <MenuItem key={value} value={value}>
              {RELATIONSHIP_LABELS[value]}
            </MenuItem>
          ))}
        </TextField>

        <Button
          startIcon={<AddIcon />}
          disabled={!studentId || pending}
          onClick={() =>
            linkStudent.mutate(
              { id: view.id, studentId, relationship },
              { onSuccess: () => setStudentId('') },
            )
          }
          sx={{ mt: 0.5 }}
        >
          Link
        </Button>
      </Stack>
    </AppDialog>
  );
}
