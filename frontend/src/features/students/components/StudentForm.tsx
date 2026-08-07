import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useClassesList } from '@/features/classes/hooks/useClasses';
import type { GuardianRelationship } from '@/features/parents';
import { AvatarPicker } from '@/features/profile';
import { ApiError } from '@/shared/api';
import { initials } from '@/shared/utils';

import type { StudentPayload } from '../api/students.api';
import { useNextAdmissionNo } from '../hooks/useStudents';
import { studentSchema, type StudentInput } from '../schemas/student.schemas';
import {
  BLOOD_GROUPS,
  BLOOD_GROUP_LABELS,
  GENDERS,
  GENDER_LABELS,
  STATUS_LABELS,
  STUDENT_STATUSES,
  type Student,
} from '../types';
import { StudentGuardiansField, type StudentGuardianLink } from './StudentGuardiansField';

interface StudentFormProps {
  /** Absent when enrolling. */
  student?: Student | null;
  isPending: boolean;
  error: unknown;
  submitLabel: string;
  onSubmit: (payload: StudentPayload) => void;
  onCancel: () => void;
}

const EMPTY = {
  admissionNo: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  photoUrl: null,
  bloodGroup: '',
  medicalNotes: '',
  classId: '',
  sectionId: '',
  status: 'ACTIVE' as const,
};

const CLASS_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

/** Section heading, so the form reads as parts rather than one long column. */
function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" component="div">
          {caption}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The enrolment form, shared by the create and edit pages.
 *
 * Holds no opinion about where it is submitted to — both pages hand it a
 * mutation — so the two cannot drift into asking for different things.
 */
export function StudentForm({
  student,
  isPending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: StudentFormProps) {
  const isEdit = Boolean(student);

  const { data: classes, isLoading: classesLoading } = useClassesList(CLASS_PARAMS);
  const classItems = classes?.items ?? [];

  // Only while enrolling: an existing student already has their number.
  const { data: nextAdmissionNo } = useNextAdmissionNo(!isEdit);

  // Guardians are a list rather than a field, so they live beside the form
  // instead of in it — the same shape the guardian side stages student links.
  const [guardians, setGuardians] = useState<StudentGuardianLink[]>([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<StudentInput, unknown, StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: EMPTY as unknown as StudentInput,
  });

  // Sections belong to a class, so the picker follows whichever is chosen.
  const classId = useWatch({ control, name: 'classId' });
  const sections = classItems.find((item) => item.id === classId)?.sections ?? [];

  // The monogram behind an empty photo follows the name as it is typed.
  const firstName = useWatch({ control, name: 'firstName' });
  const lastName = useWatch({ control, name: 'lastName' });

  // Keyed on the student rather than on a dialog opening: the edit page mounts
  // before its record arrives, so this is what fills the fields in.
  useEffect(() => {
    if (!student) return;

    reset({
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth ?? '',
      gender: student.gender ?? '',
      photoUrl: student.photoUrl,
      bloodGroup: student.bloodGroup ?? '',
      medicalNotes: student.medicalNotes ?? '',
      classId: student.classId ?? '',
      sectionId: student.sectionId ?? '',
      status: student.status,
    } as unknown as StudentInput);

    setGuardians(
      student.guardians.map((guardian) => ({
        parentId: guardian.id,
        label: `${guardian.firstName} ${guardian.lastName}`,
        relationship: guardian.relationship as GuardianRelationship,
        isPrimaryContact: guardian.isPrimaryContact,
      })),
    );
  }, [student, reset]);

  const submit = handleSubmit((values) => {
    onSubmit({
      ...values,
      // Blank means "allocate one" on enrolment, and "leave it alone" on edit —
      // the API rejects an empty string either way.
      ...(values.admissionNo ? { admissionNo: values.admissionNo } : { admissionNo: undefined }),
      // Sent on both paths: the form shows the whole set, so the whole set is
      // what it saves.
      guardians: guardians.map((guardian) => ({
        parentId: guardian.parentId,
        relationship: guardian.relationship,
        isPrimaryContact: guardian.isPrimaryContact,
      })),
    });
  });

  const apiError = error instanceof ApiError ? error : null;

  return (
    <Box component="form" noValidate onSubmit={submit}>
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack gap={2.5}>
          {apiError && (
            <Alert severity="error">
              {apiError.message}
              {apiError.fieldMessages.length > 0 && (
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                  {apiError.fieldMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </Box>
              )}
            </Alert>
          )}

          <Controller
            control={control}
            name="photoUrl"
            render={({ field }) => (
              <AvatarPicker
                value={field.value ?? null}
                fallback={initials({ firstName: firstName ?? '', lastName: lastName ?? '' })}
                disabled={isPending}
                onChange={field.onChange}
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
            <TextField
              {...register('firstName')}
              label="First name"
              autoFocus
              required
              fullWidth
              error={Boolean(errors.firstName)}
              helperText={errors.firstName?.message}
            />
            <TextField
              {...register('lastName')}
              label="Last name"
              required
              fullWidth
              error={Boolean(errors.lastName)}
              helperText={errors.lastName?.message}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
            <TextField
              {...register('admissionNo')}
              label="Admission number"
              fullWidth
              placeholder={isEdit ? undefined : (nextAdmissionNo ?? 'Generated on save')}
              error={Boolean(errors.admissionNo)}
              helperText={
                errors.admissionNo?.message ??
                (isEdit
                  ? 'Unique within the school.'
                  : nextAdmissionNo
                    ? `Leave blank to use ${nextAdmissionNo}.`
                    : 'Leave blank to have one generated.')
              }
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />

            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <TextField {...field} select label="Status" sx={{ minWidth: 180 }}>
                  {STUDENT_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
            <TextField
              {...register('dateOfBirth')}
              label="Date of birth"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.dateOfBirth)}
              helperText={errors.dateOfBirth?.message}
            />

            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Gender"
                  fullWidth
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">
                    <em>Not recorded</em>
                  </MenuItem>
                  {GENDERS.map((gender) => (
                    <MenuItem key={gender} value={gender}>
                      {GENDER_LABELS[gender]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="bloodGroup"
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Blood group"
                  fullWidth
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">
                    <em>Not recorded</em>
                  </MenuItem>
                  {BLOOD_GROUPS.map((group) => (
                    <MenuItem key={group} value={group}>
                      {BLOOD_GROUP_LABELS[group]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>

          <Divider />
          <SectionTitle title="Placement" />

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
            <Controller
              control={control}
              name="classId"
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Class"
                  fullWidth
                  disabled={classesLoading}
                  onChange={(event) => {
                    field.onChange(event);
                    // The old section belongs to the old class; keeping it
                    // would be rejected server-side.
                    setValue('sectionId', '' as unknown as StudentInput['sectionId']);
                  }}
                  helperText="Optional — a student can be enrolled before being placed."
                >
                  <MenuItem value="">
                    <em>Not placed</em>
                  </MenuItem>
                  {classItems.map((schoolClass) => (
                    <MenuItem key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="sectionId"
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Section"
                  fullWidth
                  disabled={!classId || sections.length === 0}
                  helperText={
                    !classId
                      ? 'Choose a class first.'
                      : sections.length === 0
                        ? 'That class has no sections.'
                        : ' '
                  }
                >
                  <MenuItem value="">
                    <em>Unassigned</em>
                  </MenuItem>
                  {sections.map((section) => (
                    <MenuItem key={section.id} value={section.id}>
                      {section.name}
                      {section.division ? ` — ${section.division}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>

          <Divider />
          <SectionTitle
            title={`Guardians ${guardians.length > 0 ? `(${guardians.length})` : ''}`}
            caption="The starred guardian is the one the office calls first."
          />

          <Paper variant="outlined" sx={{ p: 2 }}>
            <StudentGuardiansField
              value={guardians}
              onChange={setGuardians}
              enabled
              disabled={isPending}
            />
          </Paper>

          <Divider />
          <SectionTitle title="Medical information" />

          <TextField
            {...register('medicalNotes')}
            label="Allergies, conditions, medication"
            placeholder="Peanut allergy — EpiPen in the school office."
            multiline
            minRows={3}
            fullWidth
            error={Boolean(errors.medicalNotes)}
            helperText={
              errors.medicalNotes?.message ??
              'Shown to whoever handles an incident. Keep it factual.'
            }
          />
        </Stack>
      </Paper>

      {/* Outside the panel and sticky, so a long form never hides its own
          save button. */}
      <Stack
        direction="row"
        justifyContent="flex-end"
        gap={1.5}
        sx={{
          position: 'sticky',
          bottom: 0,
          py: 2,
          mt: 1,
          bgcolor: 'background.default',
        }}
      >
        <Button color="inherit" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
      </Stack>
    </Box>
  );
}
