import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import StarIcon from '@mui/icons-material/Star';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { initials } from '@/shared/utils';

import type { Student, StudentGuardian } from '../../types';

function GuardianCard({ guardian }: { guardian: StudentGuardian }) {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        p: 2,
        flex: '1 1 280px',
        // The one the office calls first is marked on the card, not just in a
        // list — this tab is read in a hurry.
        ...(guardian.isPrimaryContact ? { borderColor: 'success.main' } : {}),
      }}
    >
      <Stack direction="row" gap={1.5} alignItems="flex-start">
        <Avatar sx={{ width: 40, height: 40, fontSize: '0.875rem', bgcolor: 'secondary.main' }}>
          {initials(guardian)}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={600} noWrap>
              {guardian.firstName} {guardian.lastName}
            </Typography>
            {guardian.isPrimaryContact && (
              <Chip
                icon={<StarIcon sx={{ fontSize: 14 }} />}
                label="Primary"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ textTransform: 'capitalize' }}
          >
            {guardian.relationship.toLowerCase()}
          </Typography>

          {guardian.phone ? (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 1 }}>
              <CallOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              {/* A real link: on a phone or a laptop with a softphone, this is
                  the fastest path from "who do I call" to calling them. */}
              <Typography
                variant="body2"
                component="a"
                href={`tel:${guardian.phone}`}
                sx={{ color: 'primary.main', textDecoration: 'none' }}
              >
                {guardian.phone}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.disabled" component="div" sx={{ mt: 1 }}>
              No number recorded
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

interface ParentsTabProps {
  student: Student;
  canEdit: boolean;
  onManage: () => void;
}

/** Who is responsible for this student, and how to reach them. */
export function ParentsTab({ student, canEdit, onManage }: ParentsTabProps) {
  if (student.guardians.length === 0) {
    return (
      <Paper elevation={0} variant="outlined" sx={{ p: 5 }}>
        <Stack alignItems="center" gap={1}>
          <FamilyRestroomOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
          <Typography variant="subtitle2" color="text.secondary">
            No guardians linked
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
            Nobody is recorded as responsible for this student, so the school has no one to call.
          </Typography>
          {canEdit && (
            <Button size="small" startIcon={<EditOutlinedIcon />} onClick={onManage} sx={{ mt: 1 }}>
              Add guardians
            </Button>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap={2}>
      <Stack direction="row" gap={2} flexWrap="wrap">
        {student.guardians.map((guardian) => (
          <GuardianCard key={guardian.id} guardian={guardian} />
        ))}
      </Stack>

      {canEdit && (
        <Box>
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={onManage}>
            Manage guardians
          </Button>
        </Box>
      )}
    </Stack>
  );
}
