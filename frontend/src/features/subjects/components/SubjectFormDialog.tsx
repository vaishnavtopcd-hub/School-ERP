import { zodResolver } from '@hookform/resolvers/zod';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useClassesList, useEligibleTeachers } from '@/features/classes/hooks/useClasses';
import { AppDialog } from '@/shared/components';

import { useCreateSubject, useUpdateSubject } from '../hooks/useSubjects';
import { subjectSchema, type SubjectInput } from '../schemas/subject.schemas';
import { MAX_SUBJECT_CREDITS, type Subject } from '../types';

interface SubjectFormDialogProps {
  open: boolean;
  subject?: Subject | null;
  /** Preselected when creating from a filtered view. */
  defaultClassId?: string;
  onClose: () => void;
}

/**
 * Cast where it is used, as the other form dialogs do: the schema's input and
 * output types differ (`teacherId` becomes null, `isActive` gains a default),
 * and `zodResolver`'s generics do not carry that distinction through.
 */
const EMPTY = {
  code: '',
  name: '',
  classId: '',
  teacherId: '',
  credits: 0,
  isActive: true,
};

/** Enough to cover any school's class list without paging inside a picker. */
const CLASS_PICKER_PARAMS = { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' } as const;

export function SubjectFormDialog({
  open,
  subject,
  defaultClassId,
  onClose,
}: SubjectFormDialogProps) {
  const isEdit = Boolean(subject);
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const mutation = isEdit ? updateSubject : createSubject;

  // Both pickers are served by the classes module rather than duplicated here —
  // which is why a role granted subject:* also needs class:read.
  const { data: classes, isLoading: classesLoading } = useClassesList(CLASS_PICKER_PARAMS, open);
  const { data: teachers = [], isLoading: teachersLoading } = useEligibleTeachers(undefined, open);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubjectInput, unknown, SubjectInput>({
    resolver: zodResolver(subjectSchema),
    defaultValues: EMPTY as unknown as SubjectInput,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      (subject
        ? {
            code: subject.code,
            name: subject.name,
            classId: subject.class.id,
            teacherId: subject.teacher?.id ?? '',
            credits: subject.credits,
            isActive: subject.isActive,
          }
        : { ...EMPTY, classId: defaultClassId ?? '' }) as unknown as SubjectInput,
    );
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject, defaultClassId]);

  const onSubmit = handleSubmit((values) => {
    if (subject) {
      updateSubject.mutate({ id: subject.id, input: values }, { onSuccess: onClose });
    } else {
      createSubject.mutate(values, { onSuccess: onClose });
    }
  });

  const classItems = classes?.items ?? [];

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit subject' : 'Add subject'}
      subtitle={isEdit ? subject?.name : 'Subjects belong to a single class.'}
      icon={MenuBookOutlinedIcon}
      maxWidth="sm"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Add subject'}
      onSubmit={onSubmit}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('code')}
          label="Subject code"
          placeholder="MATH101"
          autoFocus
          error={Boolean(errors.code)}
          helperText={errors.code?.message ?? 'Unique within the class.'}
          // Upper-cased on save; showing it that way avoids a surprise.
          inputProps={{ style: { textTransform: 'uppercase' } }}
        />

        <TextField
          {...register('credits')}
          label="Credits"
          type="number"
          error={Boolean(errors.credits)}
          helperText={errors.credits?.message ?? `0 to ${MAX_SUBJECT_CREDITS}.`}
        />
      </Stack>

      <TextField
        {...register('name')}
        label="Subject name"
        placeholder="Mathematics"
        error={Boolean(errors.name)}
        helperText={errors.name?.message ?? 'Unique within the class.'}
      />

      <Controller
        control={control}
        name="classId"
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            select
            label="Class"
            required
            disabled={classesLoading}
            error={Boolean(errors.classId)}
            helperText={
              errors.classId?.message ??
              (classesLoading
                ? 'Loading classes…'
                : classItems.length === 0
                  ? 'No classes in the active academic year yet — add one under Classes.'
                  : 'The class this subject is taught to.')
            }
          >
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
        name="teacherId"
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            select
            label="Teacher"
            disabled={teachersLoading}
            helperText={
              teachersLoading
                ? 'Loading teachers…'
                : 'Optional — a subject can exist before staffing is decided.'
            }
          >
            <MenuItem value="">
              <em>Unassigned</em>
            </MenuItem>
            {/* Unlike a class teacher, a teacher may hold any number of
                subjects, so none of these are ever disabled. */}
            {teachers.map((teacher) => (
              <MenuItem key={teacher.id} value={teacher.id}>
                <ListItemText
                  primary={`${teacher.firstName} ${teacher.lastName}`}
                  secondary={teacher.email}
                />
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value ?? true} onChange={field.onChange} />}
            label="Active"
          />
        )}
      />
    </AppDialog>
  );
}
