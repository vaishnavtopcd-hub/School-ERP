import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { SchoolClass, Section } from '../types';

interface SectionsListProps {
  schoolClass: SchoolClass;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (schoolClass: SchoolClass, section: Section) => void;
  onDelete: (schoolClass: SchoolClass, section: Section) => void;
}

/**
 * Sections as they appear inside a class card.
 *
 * A list rather than a table: at three or four rows a table's header costs more
 * than it explains, and the card is too narrow to hold five columns without
 * everything wrapping.
 */
export function SectionsList({
  schoolClass,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: SectionsListProps) {
  if (schoolClass.sections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
        No sections yet. Add one to give this class capacity.
      </Typography>
    );
  }

  return (
    <Stack>
      {schoolClass.sections.map((section) => (
        <Stack
          key={section.id}
          direction="row"
          alignItems="center"
          gap={1}
          sx={{
            py: 0.875,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&:last-of-type': { borderBottom: 0 },
            // Row actions stay hidden until the row is approached, so a card
            // with four sections is not a wall of icons.
            '& .row-actions': { opacity: { xs: 1, md: 0 }, transition: 'opacity 120ms ease' },
            '&:hover .row-actions, &:focus-within .row-actions': { opacity: 1 },
            opacity: section.isActive ? 1 : 0.55,
          }}
        >
          {/* Name and division identify the section; medium qualifies it. */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
              <Typography variant="body2" fontWeight={600}>
                {section.name}
              </Typography>
              {section.division && (
                <Chip label={section.division} size="small" variant="outlined" />
              )}
              {!section.isActive && <Chip label="Inactive" size="small" />}
            </Stack>

            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {section.classTeacher
                ? `${section.classTeacher.firstName} ${section.classTeacher.lastName}`
                : 'Unassigned'}
              {section.medium ? ` · ${section.medium.name}` : ''}
            </Typography>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
          >
            {section.capacity} seats
          </Typography>

          <Stack direction="row" className="row-actions" sx={{ flexShrink: 0 }}>
            {canEdit && (
              <Tooltip title="Edit section">
                <IconButton
                  size="small"
                  aria-label={`Edit section ${section.name}`}
                  onClick={() => onEdit(schoolClass, section)}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete section">
                <IconButton
                  size="small"
                  aria-label={`Delete section ${section.name}`}
                  onClick={() => onDelete(schoolClass, section)}
                >
                  <DeleteOutlineIcon fontSize="small" color="error" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
