import { zodResolver } from '@hookform/resolvers/zod';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useRoleOptions, useUsersList } from '@/features/users/hooks/useUsers';
import { AppDialog } from '@/shared/components';

import { useCreateTeacher } from '../hooks/useTeachers';
import { createTeacherSchema, type CreateTeacherInput } from '../schemas/teacher.schemas';
import { MAX_EXPERIENCE_YEARS } from '../types';

interface TeacherFormDialogProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = {
  mode: 'new' as const,
  userId: '',
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  password: '',
  roleIds: [] as string[],
  employeeCode: '',
  qualification: '',
  specialisation: '',
  experienceYears: 0,
  joinedOn: '',
  bio: '',
};

/** Enough to cover a school's staff without paging inside a picker. */
const USER_PICKER_PARAMS = { page: 1, limit: 100 };

/**
 * Taking on a teacher.
 *
 * Two modes because both are real: someone who already has an account (a
 * headmaster who also teaches, say) versus a new member of staff who needs one.
 * The second path is handed to the users module server-side, so password rules
 * and role grantability are enforced in exactly one place.
 */
export function TeacherFormDialog({ open, onClose }: TeacherFormDialogProps) {
  const createTeacher = useCreateTeacher();

  const { data: users, isLoading: usersLoading } = useUsersList(USER_PICKER_PARAMS, open);
  const { data: roles = [], isLoading: rolesLoading } = useRoleOptions();

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTeacherInput, unknown, CreateTeacherInput>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: EMPTY as unknown as CreateTeacherInput,
  });

  const mode = watch('mode');

  useEffect(() => {
    if (!open) return;
    reset(EMPTY as unknown as CreateTeacherInput);
    createTeacher.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = handleSubmit((values) => {
    const profile = {
      employeeCode: values.employeeCode,
      qualification: values.qualification,
      specialisation: values.specialisation,
      experienceYears: values.experienceYears,
      joinedOn: values.joinedOn,
      bio: values.bio,
    };

    createTeacher.mutate(
      values.mode === 'existing'
        ? { userId: values.userId, ...profile }
        : {
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone || null,
            password: values.password,
            roleIds: values.roleIds,
            ...profile,
          },
      { onSuccess: onClose },
    );
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Add teacher"
      subtitle="A teacher is a user with an employment record."
      icon={PersonAddAlt1OutlinedIcon}
      maxWidth="sm"
      error={createTeacher.error}
      isPending={createTeacher.isPending}
      pendingLabel="Saving…"
      confirmLabel="Add teacher"
      onSubmit={onSubmit}
    >
      <Controller
        control={control}
        name="mode"
        render={({ field }) => (
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={field.value}
            onChange={(_event, next: string | null) => next && field.onChange(next)}
          >
            <ToggleButton value="new">New account</ToggleButton>
            <ToggleButton value="existing">Existing user</ToggleButton>
          </ToggleButtonGroup>
        )}
      />

      {mode === 'existing' ? (
        <Controller
          control={control}
          name="userId"
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              select
              label="User"
              required
              disabled={usersLoading}
              error={Boolean(errors.userId)}
              helperText={
                errors.userId?.message ??
                'Someone who already signs in. The API refuses anyone who is already a teacher.'
              }
            >
              {(users?.items ?? []).map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  <ListItemText
                    primary={`${user.firstName} ${user.lastName}`}
                    secondary={user.email}
                  />
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      ) : (
        <>
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

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
            <TextField
              {...register('email')}
              label="Email"
              required
              error={Boolean(errors.email)}
              helperText={errors.email?.message ?? 'Used to sign in. Cannot be changed here later.'}
            />
            <TextField {...register('phone')} label="Phone" />
          </Stack>

          <TextField
            {...register('password')}
            label="Initial password"
            type="password"
            required
            autoComplete="new-password"
            error={Boolean(errors.password)}
            helperText={
              errors.password?.message ??
              'At least 12 characters, mixed case, a number, and a symbol. Convey it out of band.'
            }
          />

          <Controller
            control={control}
            name="roleIds"
            render={({ field }) => (
              <TextField
                {...field}
                select
                SelectProps={{ multiple: true }}
                value={field.value ?? []}
                label="Roles"
                disabled={rolesLoading}
                helperText="A teaching role is what makes them eligible for class and subject allocation."
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </>
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
          helperText={errors.employeeCode?.message ?? 'Optional. Unique within the school.'}
        />
        <TextField
          {...register('experienceYears')}
          label="Experience (years)"
          type="number"
          error={Boolean(errors.experienceYears)}
          helperText={errors.experienceYears?.message ?? `0 to ${MAX_EXPERIENCE_YEARS}.`}
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

      <TextField
        {...register('joinedOn')}
        label="Joining date"
        type="date"
        InputLabelProps={{ shrink: true }}
        error={Boolean(errors.joinedOn)}
        helperText={errors.joinedOn?.message}
      />
    </AppDialog>
  );
}
