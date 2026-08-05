import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { AppDialog } from './AppDialog';

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Reds the confirm button and swaps the icon for destructive actions. */
  destructive?: boolean;
  isPending?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onClose: () => void;
}

/** Shared confirmation for delete / disable / archive-style actions. */
export function ConfirmActionDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive = false,
  isPending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmActionDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={title}
      icon={destructive ? WarningAmberIcon : HelpOutlineIcon}
      tone={destructive ? 'danger' : 'default'}
      maxWidth="xs"
      error={error}
      isPending={isPending}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
    >
      <Typography variant="body2" color="text.secondary" component="div">
        {body}
      </Typography>
    </AppDialog>
  );
}
