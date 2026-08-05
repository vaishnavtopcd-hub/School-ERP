import { zodResolver } from '@hookform/resolvers/zod';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useClassesList } from '@/features/classes/hooks/useClasses';
import { AppDialog } from '@/shared/components';

import { useCreateStudent, useUpdateStudent } from '../hooks/useStudents';
import { studentSchema, type StudentInput } from '../schemas/student.schemas';
import { STATUS_LABELS, STUDENT_STATUSES, type Student } from '../types';

interface StudentFormDialogProps {
  open: boolean;
  student?: Student | null;
  onClose: () => void;
}

const EMPTY = {
  admissionNo: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  classId: '',
  sectionId: '',
  status: 'ACTIVE' as const,
};

const CLASS_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

export function StudentFormDialog({ open, student, onClose }: StudentFormDialogProps) {
  const isEdit = Boolean(student);
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const mutation = isEdit ? updateStudent : createStudent;

  const { data: classes, isLoading: classesLoading } = useClassesList(CLASS_PARAMS, open);
  const classItems = classes?.items ?? [];

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

  useEffect(() => {
    if (!open) return;
    reset(
      (student
        ? {
            admissionNo: student.admissionNo,
            firstName: student.firstName,
            lastName: student.lastName,
            dateOfBirth: student.dateOfBirth ?? '',
            classId: student.classId ?? '',
            sectionId: student.sectionId ?? '',
            status: student.status,
          }
        : EMPTY) as unknown as StudentInput,
    );
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student]);

  const onSubmit = handleSubmit((values) => {
    if (student) {
      updateStudent.mutate({ id: student.id, input: values }, { onSuccess: onClose });
    } else {
      createStudent.mutate(values, { onSuccess: onClose });
    }
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit student' : 'Enrol student'}
      subtitle={isEdit ? `${student?.firstName} ${student?.lastName}` : undefined}
      icon={SchoolOutlinedIcon}
      maxWidth="sm"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Enrol student'}
      onSubmit={onSubmit}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('admissionNo')}
          label="Admission number"
          placeholder="ADM-2026-014"
          autoFocus
          required
          error={Boolean(errors.admissionNo)}
          helperText={errors.admissionNo?.message ?? 'Unique within the school.'}
          inputProps={{ style: { textTransform: 'uppercase' } }}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <TextField {...field} select label="Status">
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
          {...register('firstName')}
          label="First name"
          required
          error={Boolean(errors.firstName)}
          helperText={errors.firstName?.message}
        />
        <TextField
          {...register('lastName')}
          label="Last name"
          required
          error={Boolean(errors.lastName)}
          helperText={errors.lastName?.message}
        />
      </Stack>

      <TextField
        {...register('dateOfBirth')}
        label="Date of birth"
        type="date"
        InputLabelProps={{ shrink: true }}
        error={Boolean(errors.dateOfBirth)}
        helperText={errors.dateOfBirth?.message}
      />

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
              disabled={classesLoading}
              onChange={(event) => {
                field.onChange(event);
                // The old section belongs to the old class; keeping it would
                // be rejected server-side.
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
    </AppDialog>
  );
}
