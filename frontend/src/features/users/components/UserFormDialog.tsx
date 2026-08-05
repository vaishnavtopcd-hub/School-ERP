import { zodResolver } from '@hookform/resolvers/zod';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';

import { PasswordField } from '@/features/auth';
import { AppDialog } from '@/shared/components';

import { useCreateUser, useRoleOptions, useUpdateUser } from '../hooks/useUsers';
import { createUserSchema, updateUserSchema, type CreateUserInput } from '../schemas/user.schemas';
import { ASSIGNABLE_STATUSES, STATUS_LABELS, type ManagedUser } from '../types';

interface UserFormDialogProps {
  open: boolean;
  /** Absent for create, present for edit. */
  user?: ManagedUser | null;
  onClose: () => void;
}

const EMPTY_FORM: CreateUserInput = {
  email: '',
  firstName: '',
  lastName: '',
  phone: undefined,
  password: '',
  status: 'ACTIVE',
  roleIds: [],
};

/**
 * One dialog for both create and edit.
 *
 * The form is always typed to the create shape; in edit mode the resolver
 * swaps to the profile-only schema and the extra fields are neither rendered
 * nor submitted. Password, status, and roles have their own dialogs, so each
 * privileged action stays a deliberate, separately-audited step.
 */
export function UserFormDialog({ open, user, onClose }: UserFormDialogProps) {
  const isEdit = Boolean(user);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { data: roleOptions = [] } = useRoleOptions();

  const mutation = isEdit ? updateUser : createUser;

  const form = useForm<CreateUserInput>({
    // updateUserSchema validates a subset of the same field names, so it is a
    // safe resolver for this form type — the cast just reconciles the generics.
    resolver: (isEdit
      ? zodResolver(updateUserSchema)
      : zodResolver(createUserSchema)) as Resolver<CreateUserInput>,
    defaultValues: EMPTY_FORM,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  // Repopulate whenever the dialog opens against a different user.
  useEffect(() => {
    if (!open) return;

    reset(
      user
        ? {
            ...EMPTY_FORM,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone ?? undefined,
          }
        : EMPTY_FORM,
    );
    mutation.reset();
    // `reset` and `mutation` are stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const handleClose = () => {
    if (!mutation.isPending) onClose();
  };

  const onSubmit = handleSubmit((values) => {
    if (user) {
      updateUser.mutate(
        {
          id: user.id,
          input: {
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            phone: values.phone,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createUser.mutate(values, { onSuccess: onClose });
    }
  });

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit user' : 'Create user'}
      subtitle={
        isEdit
          ? 'Roles and passwords are changed separately.'
          : 'The account can sign in as soon as it is created.'
      }
      icon={isEdit ? PersonOutlineIcon : PersonAddAlt1OutlinedIcon}
      error={mutation.error}
      isPending={mutation.isPending}
      pendingLabel="Saving…"
      confirmLabel={isEdit ? 'Save changes' : 'Create user'}
      onSubmit={onSubmit}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2.5}>
        <TextField
          {...register('firstName')}
          label="First name"
          autoFocus
          error={Boolean(errors.firstName)}
          helperText={errors.firstName?.message}
        />
        <TextField
          {...register('lastName')}
          label="Last name"
          error={Boolean(errors.lastName)}
          helperText={errors.lastName?.message}
        />
      </Stack>

      <TextField
        {...register('email')}
        label="Email"
        type="email"
        error={Boolean(errors.email)}
        helperText={errors.email?.message}
      />

      <TextField
        {...register('phone')}
        label="Phone (optional)"
        error={Boolean(errors.phone)}
        helperText={errors.phone?.message}
      />

      {!isEdit && (
        <>
          <PasswordField
            {...register('password')}
            label="Initial password"
            autoComplete="new-password"
            error={Boolean(errors.password)}
            helperText={
              errors.password?.message ??
              'Convey this to the user out of band. They can change it after signing in.'
            }
          />

          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <TextField {...field} select label="Status">
                {ASSIGNABLE_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="roleIds"
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? []}
                select
                label="Roles"
                slotProps={{
                  select: {
                    multiple: true,
                    // Values are ids; the chips have to show names.
                    renderValue: (selected) =>
                      (selected as string[])
                        .map((id) => roleOptions.find((role) => role.id === id)?.name ?? id)
                        .join(', '),
                  },
                }}
                helperText="Leave empty to create an account with no privileges yet."
              >
                {roleOptions.map((role) => (
                  <MenuItem
                    key={role.id}
                    value={role.id}
                    // Only the platform operator may appoint a school admin.
                    disabled={role.systemKey === 'SCHOOL_ADMIN'}
                  >
                    {role.name}
                    {role.systemKey === 'SCHOOL_ADMIN' && ' — appointed by the platform operator'}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </>
      )}
    </AppDialog>
  );
}
