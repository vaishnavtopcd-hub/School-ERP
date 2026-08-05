import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';

import { ApiError } from '@/shared/api';
import { ROUTES } from '@/shared/constants';

import { AuthLayout } from '../components/AuthLayout';
import { useForgotPassword } from '../hooks/useAuthActions';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas/auth.schemas';

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit((values) => forgotPassword.mutate(values));
  const error = forgotPassword.error instanceof ApiError ? forgotPassword.error : null;

  // The API deliberately answers identically for registered and unknown
  // addresses; the UI must not undo that by saying more.
  if (forgotPassword.isSuccess) {
    return (
      <AuthLayout
        title="Check your email"
        footer={
          <Link component={RouterLink} to={ROUTES.auth.login} variant="body2">
            Back to sign in
          </Link>
        }
      >
        <Alert severity="success">
          If that address is registered, a reset link is on its way. It expires shortly, so use it
          soon.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link component={RouterLink} to={ROUTES.auth.login} variant="body2">
          Back to sign in
        </Link>
      }
    >
      {error && (
        <Alert severity={error.isRateLimited ? 'warning' : 'error'} className="mb-4">
          {error.isRateLimited
            ? 'Too many requests. Please wait a few minutes before trying again.'
            : error.message}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          {...register('email')}
          label="Email"
          type="email"
          autoComplete="username"
          autoFocus
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
        />

        <Button type="submit" variant="contained" size="large" disabled={forgotPassword.isPending}>
          {forgotPassword.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
