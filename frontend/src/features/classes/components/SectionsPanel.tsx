import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SchoolClass, Section } from '../types';
import { SectionsList } from './SectionsList';

interface SectionsPanelProps {
  schoolClass: SchoolClass;
  canEdit: boolean;
  canDelete: boolean;
  onAdd: (schoolClass: SchoolClass) => void;
  onEdit: (schoolClass: SchoolClass, section: Section) => void;
  onDelete: (schoolClass: SchoolClass, section: Section) => void;
}

/** Detail region revealed when a class row is expanded. */
export function SectionsPanel({
  schoolClass,
  canEdit,
  canDelete,
  onAdd,
  onEdit,
  onDelete,
}: SectionsPanelProps) {
  return (
    <Box sx={{ bgcolor: 'action.hover', px: { xs: 2, sm: 3 }, pt: 1.75, pb: 2.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontSize: '0.6875rem', letterSpacing: '0.06em' }}
        >
          Sections in {schoolClass.name}
        </Typography>

        {canEdit && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => onAdd(schoolClass)}>
            Add section
          </Button>
        )}
      </Stack>

      {/* Its own surface: the panel behind it is tinted, so a bare list would
          have nothing to sit on and would read as loose text. */}
      <Paper elevation={0} variant="outlined" sx={{ bgcolor: 'background.paper', px: 2, py: 0.5 }}>
        <SectionsList
          schoolClass={schoolClass}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </Paper>
    </Box>
  );
}
