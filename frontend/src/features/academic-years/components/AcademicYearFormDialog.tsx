import { zodResolver } from '@hookform/resolvers/zod';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { AppDialog } from '@/shared/components';

import { useCreateAcademicYear, useUpdateAcademicYear } from '../hooks/useAcademicYears';
import {
  createAcademicYearSchema,
  type CreateAcademicYearInput,
} from '../schemas/academic-year.schemas';
import type { AcademicYear } from '../types';

interface AcademicYearFormDialogProps {
  open: boolean;
  year?: AcademicYear | null;
  onClose: () => void;
}

const EMPTY: CreateAcademicYearInput = { name: '', startDate: '', endDate: '' };

export function AcademicYearFormDialog({ open, year, onClose }: AcademicYearFormDialogProps) {
  const isEdit = Boolean(year);
  const createYear = useCreateAcademicYear();
  const updateYear = useUpdateAcademicYear();
  const mutation = isEdit ? updateYear : createYear;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAcademicYearInput>({
    resolver: zodResolver(createAcademicYearSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(year ? { name: year.name, startDate: year.startDate, endDate: year.endDate } : EMPTY);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, year]);

  const onSubmit = handleSubmit((values) => {
    if (year) {
      updateYear.mutate({ id: year.id, input: values }, { onSuccess: onClose });
    } else {
      createYear.mutate(values, { onSuccess: onClose });
    }
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit academic year' : 'Create academic year'}
      subtitle="Ranges may not overlap another year. Creating one does not activate it."
      icon={CalendarMonthOutlinedIcon}
      maxWidth="xs"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Create'}
      onSubmit={onSubmit}
    >
      <TextField
        {...register('name')}
        label="Name"
        placeholder="2025-2026"
        autoFocus
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('startDate')}
          label="Start date"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          error={Boolean(errors.startDate)}
          helperText={errors.startDate?.message}
        />

        <TextField
          {...register('endDate')}
          label="End date"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          error={Boolean(errors.endDate)}
          helperText={errors.endDate?.message}
        />
      </Stack>
    </AppDialog>
  );
}
