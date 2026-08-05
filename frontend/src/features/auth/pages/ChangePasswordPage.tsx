import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';

import { ApiError } from '@/shared/api';
import { ROUTES } from '@/shared/constants';

import { PasswordField } from '../components/PasswordField';
import { useChangePassword } from '../hooks/useAuthActions';
import { changePasswordSchema, type ChangePasswordInput } from '../schemas/auth.schemas';

export default function ChangePasswordPage() {
  const changePassword = useChangePassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit((values) => changePassword.mutate(values));
  const error = changePassword.error instanceof ApiError ? changePassword.error : null;

  // The server revoked every session, this one included — so send them to log in.
  if (changePassword.isSuccess) {
    return <Navigate to={ROUTES.auth.login} replace state={{ passwordChanged: true }} />;
  }

  return (
    <Box className="p-6">
      <Paper elevation={0} variant="outlined" className="max-w-md p-8">
        <Typography variant="h2" gutterBottom>
          Change password
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mb-6">
          For your security, this signs you out of every device.
        </Typography>

        {error && (
          <Alert severity="error" className="mb-4">
            {error.message}
          </Alert>
        )}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <PasswordField
            {...register('currentPassword')}
            label="Current password"
            autoComplete="current-password"
            error={Boolean(errors.currentPassword)}
            helperText={errors.currentPassword?.message}
          />

          <PasswordField
            {...register('newPassword')}
            label="New password"
            autoComplete="new-password"
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

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={changePassword.isPending}
          >
            {changePassword.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
