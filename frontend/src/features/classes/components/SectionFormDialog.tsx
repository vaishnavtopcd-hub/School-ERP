import { zodResolver } from '@hookform/resolvers/zod';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import FormControlLabel from '@mui/material/FormControlLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useMediums } from '@/features/mediums/hooks/useMediums';
import { AppDialog } from '@/shared/components';

import { useCreateSection, useEligibleTeachers, useUpdateSection } from '../hooks/useClasses';
import { sectionSchema, type SectionInput } from '../schemas/class.schemas';
import type { SchoolClass, Section } from '../types';

interface SectionFormDialogProps {
  open: boolean;
  parentClass: SchoolClass | null;
  section?: Section | null;
  onClose: () => void;
}

const EMPTY = {
  name: '',
  capacity: 40,
  division: '',
  mediumId: '',
  classTeacherId: '',
  isActive: true,
};

export function SectionFormDialog({ open, parentClass, section, onClose }: SectionFormDialogProps) {
  const isEdit = Boolean(section);
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const mutation = isEdit ? updateSection : createSection;

  const { data: teachers = [], isLoading: teachersLoading } = useEligibleTeachers(
    parentClass?.academicYearId,
    open,
  );

  // Only mediums still on offer — a retired one should not be selectable, even
  // though sections already using it keep it.
  const { data: mediums = [], isLoading: mediumsLoading } = useMediums(true, open);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SectionInput, unknown, SectionInput>({
    resolver: zodResolver(sectionSchema),
    defaultValues: EMPTY as unknown as SectionInput,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      (section
        ? {
            name: section.name,
            capacity: section.capacity,
            division: section.division,
            mediumId: section.medium?.id ?? '',
            classTeacherId: section.classTeacher?.id ?? '',
            isActive: section.isActive,
          }
        : EMPTY) as unknown as SectionInput,
    );
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section]);

  const onSubmit = handleSubmit((values) => {
    if (section) {
      updateSection.mutate({ id: section.id, input: values }, { onSuccess: onClose });
    } else if (parentClass) {
      createSection.mutate({ classId: parentClass.id, input: values }, { onSuccess: onClose });
    }
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit section' : 'Add section'}
      subtitle={parentClass ? `In ${parentClass.name}` : undefined}
      icon={GroupsOutlinedIcon}
      maxWidth="xs"
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Add section'}
      onSubmit={onSubmit}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('name')}
          label="Section name"
          placeholder="A"
          autoFocus
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
        />

        <TextField
          {...register('capacity')}
          label="Capacity"
          type="number"
          error={Boolean(errors.capacity)}
          helperText={errors.capacity?.message ?? 'Maximum students.'}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('division')}
          label="Division"
          placeholder="Science"
          error={Boolean(errors.division)}
          helperText={errors.division?.message ?? 'Optional — e.g. Science / Commerce.'}
        />

        {/* Options come from the mediums module, so a school's own list drives
            this rather than a hardcoded set. */}
        <Controller
          control={control}
          name="mediumId"
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              select
              label="Medium"
              disabled={mediumsLoading}
              error={Boolean(errors.mediumId)}
              helperText={
                errors.mediumId?.message ??
                (mediumsLoading
                  ? 'Loading…'
                  : mediums.length === 0
                    ? 'No mediums defined yet — add them under Mediums.'
                    : 'Language of instruction.')
              }
            >
              <MenuItem value="">
                <em>Not set</em>
              </MenuItem>
              {mediums.map((medium) => (
                <MenuItem key={medium.id} value={medium.id}>
                  {medium.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Stack>

      <Controller
        control={control}
        name="classTeacherId"
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            select
            label="Class teacher"
            disabled={teachersLoading}
            helperText={
              teachersLoading
                ? 'Loading teachers…'
                : 'A teacher may hold only one section per academic year.'
            }
          >
            <MenuItem value="">
              <em>Unassigned</em>
            </MenuItem>
            {teachers.map((teacher) => {
              // Already holds another section — the API would reject it,
              // unless it is the one this section already has.
              const isTaken = teacher.isAssigned && teacher.id !== section?.classTeacher?.id;

              return (
                <MenuItem key={teacher.id} value={teacher.id} disabled={isTaken}>
                  <ListItemText
                    primary={`${teacher.firstName} ${teacher.lastName}`}
                    secondary={
                      isTaken ? (
                        <Typography variant="caption" color="text.secondary">
                          Already class teacher of {teacher.assignedTo}
                        </Typography>
                      ) : (
                        teacher.email
                      )
                    }
                  />
                </MenuItem>
              );
            })}
          </TextField>
        )}
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
