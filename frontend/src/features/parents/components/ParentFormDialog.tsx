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

import { useCreateParent } from '../hooks/useParents';
import { createParentSchema, type CreateParentInput } from '../schemas/parent.schemas';
import { DEFAULT_PARENT_ROLE_NAME } from '../types';

interface ParentFormDialogProps {
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
  occupation: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  notes: '',
};

const USER_PICKER_PARAMS = { page: 1, limit: 100 };

export function ParentFormDialog({ open, onClose }: ParentFormDialogProps) {
  const createParent = useCreateParent();

  const { data: users, isLoading: usersLoading } = useUsersList(USER_PICKER_PARAMS, open);
  const { data: roles = [], isLoading: rolesLoading } = useRoleOptions();

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateParentInput, unknown, CreateParentInput>({
    resolver: zodResolver(createParentSchema),
    defaultValues: EMPTY as unknown as CreateParentInput,
  });

  const mode = watch('mode');

  useEffect(() => {
    if (!open) return;
    // Preselect the Parent role so the common case is one less decision. Name
    // matching is a convenience here, not an authorization outcome.
    const parentRole = roles.find((role) => role.name === DEFAULT_PARENT_ROLE_NAME);
    reset({
      ...EMPTY,
      roleIds: parentRole ? [parentRole.id] : [],
    } as unknown as CreateParentInput);
    createParent.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roles]);

  const onSubmit = handleSubmit((values) => {
    const profile = {
      occupation: values.occupation,
      emergencyContactName: values.emergencyContactName,
      emergencyContactPhone: values.emergencyContactPhone,
      emergencyContactRelation: values.emergencyContactRelation,
      notes: values.notes,
    };

    createParent.mutate(
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
      title="Add guardian"
      subtitle="A guardian is a user with a guardian record."
      icon={PersonAddAlt1OutlinedIcon}
      maxWidth="sm"
      error={createParent.error}
      isPending={createParent.isPending}
      pendingLabel="Saving…"
      confirmLabel="Add guardian"
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
                'The API refuses anyone who is already recorded as a guardian.'
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
              helperText={errors.email?.message ?? 'Used to sign in.'}
            />
            <TextField {...register('phone')} label="Contact number" />
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
              'At least 12 characters, mixed case, a number, and a symbol.'
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
                helperText="Defaults to the Parent role."
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
        Guardian record
      </Typography>

      <TextField
        {...register('occupation')}
        label="Occupation"
        error={Boolean(errors.occupation)}
        helperText={errors.occupation?.message}
      />

      <Typography variant="caption" color="text.secondary">
        Emergency contact — who to call when this guardian cannot be reached.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('emergencyContactName')}
          label="Name"
          error={Boolean(errors.emergencyContactName)}
          helperText={errors.emergencyContactName?.message}
        />
        <TextField
          {...register('emergencyContactPhone')}
          label="Phone"
          error={Boolean(errors.emergencyContactPhone)}
          helperText={errors.emergencyContactPhone?.message}
        />
        <TextField
          {...register('emergencyContactRelation')}
          label="Relationship"
          placeholder="Uncle"
          error={Boolean(errors.emergencyContactRelation)}
          helperText={errors.emergencyContactRelation?.message}
        />
      </Stack>
    </AppDialog>
  );
}
