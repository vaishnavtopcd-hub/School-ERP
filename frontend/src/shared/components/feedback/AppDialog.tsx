import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import type { ReactNode } from 'react';

import { ApiError } from '@/shared/api';

export type DialogTone = 'default' | 'danger' | 'warning' | 'info' | 'success';

interface AppDialogProps {
  open: boolean;
  onClose: () => void;

  title: string;
  /** One line of context under the title. */
  subtitle?: string;
  /** Icon tile beside the title. */
  icon?: SvgIconComponent;
  /** Colours the icon tile and the confirm button. */
  tone?: DialogTone;

  maxWidth?: 'xs' | 'sm' | 'md';

  /** Rendered as an alert above the content. `ApiError` field messages are listed. */
  error?: unknown;
  /** Blocks dismissal and disables both buttons while true. */
  isPending?: boolean;

  confirmLabel: string;
  /** Replaces the confirm label while pending. */
  pendingLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;

  /**
   * Supply for a form dialog: the body is wrapped in a `<form>` and the confirm
   * button submits it, so Enter works. Otherwise give `onConfirm` instead.
   */
  onSubmit?: () => void;
  onConfirm?: () => void;

  children: ReactNode;
}

const TONE_COLOR: Record<DialogTone, string> = {
  default: 'primary.main',
  danger: 'error.main',
  warning: 'warning.main',
  info: 'info.main',
  success: 'success.main',
};

const TONE_BUTTON: Record<DialogTone, 'primary' | 'error' | 'warning' | 'info' | 'success'> = {
  default: 'primary',
  danger: 'error',
  warning: 'warning',
  info: 'info',
  success: 'success',
};

/**
 * The one dialog shell every modal in the app uses.
 *
 * Centralising it means dismissal-while-saving, error rendering, button order,
 * and spacing cannot drift apart per feature — previously each dialog made its
 * own call on all four.
 */
export function AppDialog({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = 'default',
  maxWidth = 'sm',
  error,
  isPending = false,
  confirmLabel,
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  onSubmit,
  onConfirm,
  children,
}: AppDialogProps) {
  const apiError = error instanceof ApiError ? error : null;
  const isForm = Boolean(onSubmit);

  const body = (
    <>
      {/* --- Header --------------------------------------------------------- */}
      <Stack direction="row" alignItems="flex-start" gap={1.75} sx={{ p: 3, pb: 2 }}>
        {Icon && (
          <Box
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: TONE_COLOR[tone],
              bgcolor: (theme) =>
                alpha(
                  theme.palette[TONE_BUTTON[tone]]?.main ?? theme.palette.primary.main,
                  isPending ? 0.08 : 0.12,
                ),
            }}
          >
            <Icon sx={{ fontSize: 21 }} />
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0, pt: Icon ? 0.25 : 0 }}>
          <Typography variant="h4" component="h2">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        <IconButton
          onClick={onClose}
          disabled={isPending}
          aria-label="Close"
          size="small"
          sx={{ mt: -0.5, mr: -0.5, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* --- Body ----------------------------------------------------------- */}
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {apiError.fieldMessages.length > 0 ? (
              <>
                <AlertTitle sx={{ mb: 0.5 }}>{apiError.message}</AlertTitle>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {apiError.fieldMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </Box>
              </>
            ) : (
              apiError.message
            )}
          </Alert>
        )}

        <Stack gap={2.5}>{children}</Stack>
      </DialogContent>

      {/* --- Actions --------------------------------------------------------- */}
      <DialogActions sx={{ px: 3, py: 2.25, gap: 1 }}>
        <Button onClick={onClose} disabled={isPending} color="inherit">
          {cancelLabel}
        </Button>
        <Button
          type={isForm ? 'submit' : 'button'}
          onClick={isForm ? undefined : onConfirm}
          variant="contained"
          color={TONE_BUTTON[tone]}
          disabled={isPending || confirmDisabled}
        >
          {isPending ? pendingLabel : confirmLabel}
        </Button>
      </DialogActions>
    </>
  );

  return (
    <Dialog
      open={open}
      // Dismissing mid-save would leave the user unsure whether it applied.
      onClose={isPending ? undefined : onClose}
      fullWidth
      maxWidth={maxWidth}
      slotProps={{ paper: { sx: { borderRadius: 3.5 } } }}
    >
      {isForm ? (
        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          {body}
        </Box>
      ) : (
        body
      )}
    </Dialog>
  );
}
