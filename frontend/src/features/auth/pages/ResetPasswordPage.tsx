import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '@/shared/api';
import { ROUTES } from '@/shared/constants';

import { AuthLayout } from '../components/AuthLayout';
import { PasswordField } from '../components/PasswordField';
import { useResetPassword } from '../hooks/useAuthActions';
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/auth.schemas';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const resetPassword = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit((values) => resetPassword.mutate(values));
  const error = resetPassword.error instanceof ApiError ? resetPassword.error : null;

  // A link without a token can only have been mistyped or truncated.
  if (!token) {
    return (
      <AuthLayout
        title="Link is incomplete"
        footer={
          <Link component={RouterLink} to={ROUTES.auth.forgotPassword} variant="body2">
            Request a new link
          </Link>
        }
      >
        <Alert severity="error">
          This reset link is missing its token. Request a fresh one and open it directly from the
          email.
        </Alert>
      </AuthLayout>
    );
  }

  if (resetPassword.isSuccess) {
    return <Navigate to={ROUTES.auth.login} replace state={{ passwordReset: true }} />;
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="This signs you out everywhere else.">
      {error && (
        <Alert severity="error" className="mb-4">
          {error.message}
          {error.fieldMessages.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {error.fieldMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <input type="hidden" {...register('token')} />

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

        <Button type="submit" variant="contained" size="large" disabled={resetPassword.isPending}>
          {resetPassword.isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
