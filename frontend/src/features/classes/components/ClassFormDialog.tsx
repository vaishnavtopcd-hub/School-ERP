import { zodResolver } from '@hookform/resolvers/zod';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';

import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppDialog } from '@/shared/components';

import { useCreateClass, useUpdateClass } from '../hooks/useClasses';
import { classSchema, type ClassInput } from '../schemas/class.schemas';
import type { SchoolClass } from '../types';

interface ClassFormDialogProps {
  open: boolean;
  schoolClass?: SchoolClass | null;
  onClose: () => void;
}

const EMPTY: ClassInput = {
  name: '',

  isActive: true,
};

export function ClassFormDialog({ open, schoolClass, onClose }: ClassFormDialogProps) {
  const isEdit = Boolean(schoolClass);
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const mutation = isEdit ? updateClass : createClass;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassInput>({
    resolver: zodResolver(classSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      schoolClass
        ? {
            name: schoolClass.name,

            isActive: schoolClass.isActive,
          }
        : EMPTY,
    );
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schoolClass]);

  const onSubmit = handleSubmit((values) => {
    if (schoolClass) {
      updateClass.mutate({ id: schoolClass.id, input: values }, { onSuccess: onClose });
    } else {
      createClass.mutate(values, { onSuccess: onClose });
    }
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit class' : 'Create class'}
      subtitle="Classes belong to the active academic year."
      icon={MeetingRoomOutlinedIcon}
      maxWidth="xs"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Create'}
      onSubmit={onSubmit}
    >
      <TextField
        {...register('name')}
        label="Class name"
        placeholder="Class 10"
        autoFocus
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
      />

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} />}
            label="Active"
          />
        )}
      />
    </AppDialog>
  );
}
