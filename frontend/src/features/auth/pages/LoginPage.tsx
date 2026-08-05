import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '@/shared/api';
import { ROUTES } from '@/shared/constants';

import { AuthLayout } from '../components/AuthLayout';
import { PasswordField } from '../components/PasswordField';
import { useLogin } from '../hooks/useAuthActions';
import { useAuth } from '../hooks/useAuth';
import { loginSchema, type LoginInput } from '../schemas/auth.schemas';

interface LocationState {
  from?: { pathname: string };
}

export default function LoginPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Where the user was headed before the auth guard intercepted them.
  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? ROUTES.dashboard;

  if (!isInitializing && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    await login.mutateAsync(values, {
      onSuccess: () => navigate(redirectTo, { replace: true }),
    });
  });

  const error = login.error instanceof ApiError ? login.error : null;

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your school account to continue."
      footer={
        <Link component={RouterLink} to={ROUTES.auth.forgotPassword} variant="body2">
          Forgot your password?
        </Link>
      }
    >
      {error && (
        <Alert severity={error.isRateLimited ? 'warning' : 'error'} className="mb-4">
          {error.isRateLimited
            ? 'Too many attempts. Please wait a moment and try again.'
            : error.message}
        </Alert>
      )}

      {/* noValidate: zod owns validation, so the browser's native bubbles stay out of the way. */}
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

        <PasswordField
          {...register('password')}
          label="Password"
          autoComplete="current-password"
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isSubmitting || login.isPending}
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
