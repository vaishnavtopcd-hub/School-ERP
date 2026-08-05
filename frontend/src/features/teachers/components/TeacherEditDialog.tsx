import { zodResolver } from '@hookform/resolvers/zod';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AvatarPicker } from '@/features/profile';
import { AppDialog } from '@/shared/components';
import { initials } from '@/shared/utils';

import { useUpdateTeacher } from '../hooks/useTeachers';
import { updateTeacherSchema, type UpdateTeacherInput } from '../schemas/teacher.schemas';
import { MAX_EXPERIENCE_YEARS, type Teacher } from '../types';

interface TeacherEditDialogProps {
  open: boolean;
  teacher: Teacher | null;
  onClose: () => void;
}

/**
 * Editing a teacher: the employment record and the contact details that live on
 * their user row, including the photo.
 *
 * Email, status, and roles are absent by design — each is a privileged action
 * with its own endpoint under /users, and folding them in here would make one
 * "save" mean four different audited things.
 */
export function TeacherEditDialog({ open, teacher, onClose }: TeacherEditDialogProps) {
  const updateTeacher = useUpdateTeacher();
  const [avatar, setAvatar] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateTeacherInput, unknown, UpdateTeacherInput>({
    resolver: zodResolver(updateTeacherSchema),
  });

  useEffect(() => {
    if (!open || !teacher) return;
    reset({
      employeeCode: teacher.employeeCode ?? '',
      qualification: teacher.qualification ?? '',
      specialisation: teacher.specialisation ?? '',
      experienceYears: teacher.experienceYears,
      joinedOn: teacher.joinedOn ?? '',
      bio: teacher.bio ?? '',
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      phone: teacher.phone ?? '',
      addressLine1: teacher.addressLine1 ?? '',
      addressLine2: teacher.addressLine2 ?? '',
      city: teacher.city ?? '',
      state: teacher.state ?? '',
      postalCode: teacher.postalCode ?? '',
      country: teacher.country ?? '',
    } as unknown as UpdateTeacherInput);
    setAvatar(teacher.avatarUrl);
    updateTeacher.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teacher]);

  const onSubmit = handleSubmit((values) => {
    if (!teacher) return;

    updateTeacher.mutate(
      {
        id: teacher.id,
        input: {
          employeeCode: values.employeeCode,
          qualification: values.qualification,
          specialisation: values.specialisation,
          experienceYears: values.experienceYears,
          joinedOn: values.joinedOn,
          bio: values.bio,
          contact: {
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
            addressLine1: values.addressLine1,
            addressLine2: values.addressLine2,
            city: values.city,
            state: values.state,
            postalCode: values.postalCode,
            country: values.country,
            // Only sent when it actually changed — an unchanged photo is tens
            // of KB of data URL that would ride along on every save.
            ...(avatar !== (teacher.avatarUrl ?? null) ? { avatarUrl: avatar } : {}),
          },
        },
      },
      { onSuccess: onClose },
    );
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Edit teacher"
      subtitle={teacher ? `${teacher.firstName} ${teacher.lastName} · ${teacher.email}` : undefined}
      icon={BadgeOutlinedIcon}
      maxWidth="md"
      error={updateTeacher.error}
      isPending={updateTeacher.isPending}
      pendingLabel="Saving…"
      confirmLabel="Save changes"
      onSubmit={onSubmit}
    >
      {teacher && (
        <AvatarPicker
          value={avatar}
          fallback={initials(teacher)}
          disabled={updateTeacher.isPending}
          onChange={setAvatar}
        />
      )}

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Employment record
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('employeeCode')}
          label="Employee code"
          error={Boolean(errors.employeeCode)}
          helperText={errors.employeeCode?.message ?? 'Unique within the school.'}
        />
        <TextField
          {...register('experienceYears')}
          label="Experience (years)"
          type="number"
          error={Boolean(errors.experienceYears)}
          helperText={errors.experienceYears?.message ?? `0 to ${MAX_EXPERIENCE_YEARS}.`}
        />
        <TextField
          {...register('joinedOn')}
          label="Joining date"
          type="date"
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.joinedOn)}
          helperText={errors.joinedOn?.message}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('qualification')}
          label="Qualification"
          placeholder="M.Sc Mathematics, B.Ed"
          error={Boolean(errors.qualification)}
          helperText={errors.qualification?.message}
        />
        <TextField
          {...register('specialisation')}
          label="Specialisation"
          placeholder="Mathematics"
          error={Boolean(errors.specialisation)}
          helperText={errors.specialisation?.message}
        />
      </Stack>

      <TextField {...register('bio')} label="Notes" multiline minRows={2} />

      <Divider />
      <Typography variant="overline" color="text.secondary">
        Contact details
      </Typography>

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
        <TextField
          {...register('phone')}
          label="Phone"
          error={Boolean(errors.phone)}
          helperText={errors.phone?.message}
        />
      </Stack>

      <TextField {...register('addressLine1')} label="Address line 1" />
      <TextField {...register('addressLine2')} label="Address line 2" />

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField {...register('city')} label="City" />
        <TextField {...register('state')} label="State" />
        <TextField {...register('postalCode')} label="Postal code" />
        <TextField {...register('country')} label="Country" />
      </Stack>
    </AppDialog>
  );
}
