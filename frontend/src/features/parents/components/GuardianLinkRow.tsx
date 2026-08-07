import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { RELATIONSHIP_LABELS, type GuardianRelationship } from '../types';

interface GuardianLinkRowProps {
  title: string;
  /** Admission number, class, placement — whatever identifies the student. */
  subtitle?: string;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
  onMakePrimary: () => void;
  onRemove: () => void;
  removeLabel: string;
  disabled?: boolean;
}

/**
 * One student on a guardian, with the two things you can do to the link.
 *
 * Shared by the staged list on the add form and the live list on the students
 * dialog: the link is the same thing in both, only the moment it is written
 * differs.
 */
export function GuardianLinkRow({
  title,
  subtitle,
  relationship,
  isPrimaryContact,
  onMakePrimary,
  onRemove,
  removeLabel,
  disabled = false,
}: GuardianLinkRowProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
          <Typography variant="body2" fontWeight={600} noWrap>
            {title}
          </Typography>
          <Chip label={RELATIONSHIP_LABELS[relationship]} size="small" variant="outlined" />
        </Stack>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* One primary contact per student; setting this demotes whoever
          previously held it. */}
      <Tooltip
        title={isPrimaryContact ? 'Primary contact' : 'Make primary contact for this student'}
      >
        <span>
          <IconButton
            size="small"
            disabled={disabled || isPrimaryContact}
            aria-label={`Make primary contact for ${title}`}
            onClick={onMakePrimary}
          >
            {isPrimaryContact ? (
              <StarIcon fontSize="small" color="success" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={removeLabel}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            aria-label={`${removeLabel} ${title}`}
            onClick={onRemove}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
