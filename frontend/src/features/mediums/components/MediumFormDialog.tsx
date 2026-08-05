import { zodResolver } from '@hookform/resolvers/zod';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppDialog } from '@/shared/components';

import { useCreateMedium, useUpdateMedium } from '../hooks/useMediums';
import type { Medium } from '../types';

const mediumSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(40, 'Name is too long'),
  isActive: z.boolean().default(true),
});

type MediumFormValues = z.infer<typeof mediumSchema>;

const EMPTY: MediumFormValues = { name: '', isActive: true };

interface MediumFormDialogProps {
  open: boolean;
  medium?: Medium | null;
  onClose: () => void;
}

export function MediumFormDialog({ open, medium, onClose }: MediumFormDialogProps) {
  const isEdit = Boolean(medium);
  const createMedium = useCreateMedium();
  const updateMedium = useUpdateMedium();
  const mutation = isEdit ? updateMedium : createMedium;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MediumFormValues>({
    resolver: zodResolver(mediumSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(medium ? { name: medium.name, isActive: medium.isActive } : EMPTY);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, medium]);

  const onSubmit = handleSubmit((values) => {
    if (medium) {
      updateMedium.mutate({ id: medium.id, input: values }, { onSuccess: onClose });
    } else {
      createMedium.mutate(values, { onSuccess: onClose });
    }
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit medium' : 'Add medium'}
      subtitle={
        isEdit
          ? 'Renaming updates every section using it — they reference it by id.'
          : 'A language sections can be taught in.'
      }
      icon={TranslateOutlinedIcon}
      maxWidth="xs"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Add medium'}
      onSubmit={onSubmit}
    >
      <TextField
        {...register('name')}
        label="Name"
        placeholder="Malayalam"
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
            label="Offered"
          />
        )}
      />
    </AppDialog>
  );
}
