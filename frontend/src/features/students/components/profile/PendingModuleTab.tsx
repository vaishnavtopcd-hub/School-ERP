import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';

interface PendingModuleTabProps {
  icon: SvgIconComponent;
  title: string;
  /** What this tab will show, stated plainly. */
  description: string;
  /** The module that has to exist before it can show anything. */
  requires: string;
}

/**
 * A tab whose module does not exist yet.
 *
 * Deliberately empty rather than filled with sample figures: an attendance
 * percentage or a fee balance that nobody computed is worse than no number at
 * all — it gets read, quoted, and acted on. This says what will live here and
 * what has to be built first.
 */
export function PendingModuleTab({
  icon: Icon,
  title,
  description,
  requires,
}: PendingModuleTabProps) {
  return (
    <Paper elevation={0} variant="outlined" sx={{ p: { xs: 4, sm: 6 } }}>
      <Stack alignItems="center" gap={1.25} sx={{ maxWidth: 460, mx: 'auto', textAlign: 'center' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            color: 'text.disabled',
            bgcolor: 'action.hover',
          }}
        >
          <Icon sx={{ fontSize: 24 }} />
        </Box>

        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>

        <Typography variant="caption" color="text.disabled">
          Nothing to show yet — {requires}
        </Typography>
      </Stack>
    </Paper>
  );
}
