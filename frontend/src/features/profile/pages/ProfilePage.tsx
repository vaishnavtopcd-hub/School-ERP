import { zodResolver } from '@hookform/resolvers/zod';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useColorMode, type ColorMode } from '@/app/theme/color-mode';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { fullName, initials } from '@/shared/utils';

import type { UpdateProfilePayload } from '../api/profile.api';
import { AvatarPicker } from '../components/AvatarPicker';
import { useUpdateProfile } from '../hooks/useProfile';
import { profileSchema, type ProfileFormValues } from '../schemas/profile.schemas';

/** `system` is the absence of a pin, which the API stores as NULL. */
type ThemeChoice = 'system' | ColorMode;

/** Section wrapper — keeps the four blocks visually identical. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {description}
        </Typography>
      )}
      {!description && <Box sx={{ mb: 2.5 }} />}
      {children}
    </Paper>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const { setMode } = useColorMode();

  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [theme, setTheme] = useState<ThemeChoice>(
    user?.themePreference === 'DARK'
      ? 'dark'
      : user?.themePreference === 'LIGHT'
        ? 'light'
        : 'system',
  );
  const [saved, setSaved] = useState(false);

  const defaults = useMemo<ProfileFormValues>(
    () => ({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      addressLine1: user?.addressLine1 ?? '',
      addressLine2: user?.addressLine2 ?? '',
      city: user?.city ?? '',
      state: user?.state ?? '',
      postalCode: user?.postalCode ?? '',
      country: user?.country ?? '',
    }),
    [user],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  // The session user is replaced after every successful save, which re-baselines
  // the form so `isDirty` reports against what is actually stored.
  useEffect(() => {
    reset(defaults);
    setAvatar(user?.avatarUrl ?? null);
  }, [defaults, reset, user?.avatarUrl]);

  const storedTheme: ThemeChoice =
    user?.themePreference === 'DARK'
      ? 'dark'
      : user?.themePreference === 'LIGHT'
        ? 'light'
        : 'system';

  const avatarChanged = avatar !== (user?.avatarUrl ?? null);
  const themeChanged = theme !== storedTheme;
  const dirty = isDirty || avatarChanged || themeChanged;

  const onSubmit = handleSubmit((values) => {
    const payload: UpdateProfilePayload = { ...values };

    // Only sent when it actually changed — an unchanged avatar is tens of KB of
    // data URL that would otherwise ride along on every save.
    if (avatarChanged) payload.avatarUrl = avatar;
    if (themeChanged) {
      payload.themePreference = theme === 'system' ? null : theme === 'dark' ? 'DARK' : 'LIGHT';
    }

    update.mutate(payload, { onSuccess: () => setSaved(true) });
  });

  /** Applied at once so the choice can be seen; persisted with the form. */
  const chooseTheme = (next: ThemeChoice) => {
    setTheme(next);
    setMode(next === 'system' ? null : next);
  };

  const handleReset = () => {
    reset(defaults);
    setAvatar(user?.avatarUrl ?? null);
    chooseTheme(storedTheme);
    update.reset();
  };

  const error = update.error instanceof ApiError ? update.error : null;

  if (!user) return null;

  const fieldPair = { display: 'grid', gap: 2, gridTemplateColumns: { sm: '1fr 1fr' } } as const;

  return (
    <Box>
      <PageHeader
        breadcrumb="Account"
        title="Profile & settings"
        subtitle="Your details, picture, and how the app looks to you."
      />

      {error && (
        <Alert severity="error" className="mb-4">
          {error.message}
          {error.details && error.details.length > 0 && (
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Stack gap={2.5}>
          {/* --- Identity ------------------------------------------------- */}
          <Section title="Photo">
            <AvatarPicker
              value={avatar}
              fallback={initials(user)}
              disabled={update.isPending}
              onChange={setAvatar}
            />

            <Divider sx={{ my: 2.5 }} />

            <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {fullName(user)}
                </Typography>
                {/* Email is the login identity, so it is shown but not editable
                    — changing it needs a verification flow that does not exist. */}
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {user.email}
                </Typography>
              </Box>

              <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ ml: 'auto' }}>
                {user.roles.map((role) => (
                  <Chip key={role} label={role} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          </Section>

          {/* --- Personal details ----------------------------------------- */}
          <Section title="Personal details">
            <Stack gap={2}>
              <Box sx={fieldPair}>
                <TextField
                  {...register('firstName')}
                  label="First name"
                  required
                  autoComplete="given-name"
                  error={Boolean(errors.firstName)}
                  helperText={errors.firstName?.message}
                />
                <TextField
                  {...register('lastName')}
                  label="Last name"
                  required
                  autoComplete="family-name"
                  error={Boolean(errors.lastName)}
                  helperText={errors.lastName?.message}
                />
              </Box>

              <Box sx={fieldPair}>
                <TextField
                  {...register('phone')}
                  label="Phone"
                  autoComplete="tel"
                  error={Boolean(errors.phone)}
                  helperText={errors.phone?.message}
                />
                <TextField
                  label="Email"
                  value={user.email}
                  disabled
                  helperText="Contact an administrator to change this."
                />
              </Box>
            </Stack>
          </Section>

          {/* --- Address --------------------------------------------------- */}
          <Section title="Address" description="Optional — used for records and correspondence.">
            <Stack gap={2}>
              <TextField
                {...register('addressLine1')}
                label="Address line 1"
                autoComplete="address-line1"
                error={Boolean(errors.addressLine1)}
                helperText={errors.addressLine1?.message}
              />
              <TextField
                {...register('addressLine2')}
                label="Address line 2"
                autoComplete="address-line2"
                error={Boolean(errors.addressLine2)}
                helperText={errors.addressLine2?.message}
              />

              <Box sx={fieldPair}>
                <TextField
                  {...register('city')}
                  label="City"
                  autoComplete="address-level2"
                  error={Boolean(errors.city)}
                  helperText={errors.city?.message}
                />
                <TextField
                  {...register('state')}
                  label="State"
                  autoComplete="address-level1"
                  error={Boolean(errors.state)}
                  helperText={errors.state?.message}
                />
              </Box>

              <Box sx={fieldPair}>
                <TextField
                  {...register('postalCode')}
                  label="Postal code"
                  autoComplete="postal-code"
                  error={Boolean(errors.postalCode)}
                  helperText={errors.postalCode?.message}
                />
                <TextField
                  {...register('country')}
                  label="Country"
                  autoComplete="country-name"
                  error={Boolean(errors.country)}
                  helperText={errors.country?.message}
                />
              </Box>
            </Stack>
          </Section>

          {/* --- Appearance ------------------------------------------------ */}
          <Section
            title="Appearance"
            description="Saved to your account, so it follows you to another browser or device."
          >
            <ToggleButtonGroup
              exclusive
              value={theme}
              onChange={(_event, next: ThemeChoice | null) => next && chooseTheme(next)}
              aria-label="Colour mode"
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="system" sx={{ gap: 1, px: 2 }}>
                <SettingsBrightnessOutlinedIcon fontSize="small" />
                System
              </ToggleButton>
              <ToggleButton value="light" sx={{ gap: 1, px: 2 }}>
                <LightModeOutlinedIcon fontSize="small" />
                Light
              </ToggleButton>
              <ToggleButton value="dark" sx={{ gap: 1, px: 2 }}>
                <DarkModeOutlinedIcon fontSize="small" />
                Dark
              </ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
              {theme === 'system'
                ? 'Following your operating system setting.'
                : `Always ${theme}, whatever the device is set to.`}
            </Typography>
          </Section>

          {/* --- Actions ---------------------------------------------------- */}
          <Stack direction="row" gap={1.5} justifyContent="flex-end" sx={{ pb: 1 }}>
            <Button onClick={handleReset} disabled={!dirty || update.isPending}>
              Discard changes
            </Button>
            <Button type="submit" variant="contained" disabled={!dirty || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        </Stack>
      </form>

      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSaved(false)}>
          Profile updated.
        </Alert>
      </Snackbar>
    </Box>
  );
}
