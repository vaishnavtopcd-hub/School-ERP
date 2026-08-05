import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Parent context shown above the title, e.g. the section this page sits in. */
  breadcrumb?: string;
  title: string;
  subtitle?: string;
  /** Chips or badges rendered inline after the title. */
  meta?: ReactNode;
  /** Primary actions, rendered right-aligned on wide screens. */
  actions?: ReactNode;
}

/** Consistent title block so every page opens the same way. */
export function PageHeader({ breadcrumb, title, subtitle, meta, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {breadcrumb && (
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'text.secondary',
              mb: 0.25,
            }}
          >
            {breadcrumb}
          </Typography>
        )}

        <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap">
          <Typography variant="h2" component="h2">
            {title}
          </Typography>
          {meta}
        </Stack>

        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions && (
        <Stack direction="row" gap={1.5} sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
