import { zodResolver } from '@hookform/resolvers/zod';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import Alert from '@mui/material/Alert';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { PasswordField } from '@/features/auth';
import { AppDialog } from '@/shared/components';

import { useResetUserPassword } from '../hooks/useUsers';
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/user.schemas';
import type { ManagedUser } from '../types';

interface ResetPasswordDialogProps {
  open: boolean;
  user: ManagedUser | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ open, user, onClose }: ResetPasswordDialogProps) {
  const resetPassword = useResetUserPassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (open) {
      reset();
      resetPassword.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!user) return null;

  const onSubmit = handleSubmit((values) => {
    resetPassword.mutate({ id: user.id, input: values }, { onSuccess: onClose });
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Reset password"
      subtitle={user.email}
      icon={LockResetOutlinedIcon}
      tone="warning"
      maxWidth="xs"
      error={resetPassword.error}
      isPending={resetPassword.isPending}
      pendingLabel="Resetting…"
      confirmLabel="Reset password"
      onSubmit={onSubmit}
    >
      <Alert severity="info">
        This sets a new password without needing their current one, and signs them out everywhere.
        Give them the new password out of band.
      </Alert>

      <PasswordField
        {...register('newPassword')}
        label="New password"
        autoComplete="new-password"
        autoFocus
        error={Boolean(errors.newPassword)}
        helperText={
          errors.newPassword?.message ??
          'At least 12 characters, mixed case, a number, and a symbol.'
        }
      />

      <PasswordField
        {...register('confirmPassword')}
        label="Confirm new password"
        autoComplete="new-password"
        error={Boolean(errors.confirmPassword)}
        helperText={errors.confirmPassword?.message}
      />
    </AppDialog>
  );
}
