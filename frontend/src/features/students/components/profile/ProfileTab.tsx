import MedicalInformationOutlinedIcon from '@mui/icons-material/MedicalInformationOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatDateOnly, initials } from '@/shared/utils';

import { BLOOD_GROUP_LABELS, GENDER_LABELS, STATUS_LABELS, type Student } from '../../types';

/** One labelled fact. The label is small and quiet; the value is the content. */
export function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <Box sx={{ minWidth: 140, flex: '1 1 140px' }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
        {value ?? 'Not recorded'}
      </Typography>
    </Box>
  );
}

/** Who the student is, where they are placed, and what a nurse would need. */
export function ProfileTab({ student }: { student: Student }) {
  const placement = student.className
    ? student.sectionName
      ? `${student.className} — ${student.sectionName}`
      : student.className
    : null;

  return (
    <Stack gap={2.5}>
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} alignItems={{ sm: 'flex-start' }}>
          <Avatar
            src={student.photoUrl ?? undefined}
            variant="rounded"
            sx={{ width: 96, height: 96, borderRadius: 3, fontSize: '2rem', flexShrink: 0 }}
          >
            {initials(student)}
          </Avatar>

          <Stack gap={2.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" gap={3} flexWrap="wrap">
              <Field label="Admission number" value={student.admissionNo} />
              <Field
                label="Date of birth"
                value={student.dateOfBirth ? formatDateOnly(student.dateOfBirth) : null}
              />
              <Field label="Gender" value={student.gender ? GENDER_LABELS[student.gender] : null} />
              <Field
                label="Blood group"
                value={student.bloodGroup ? BLOOD_GROUP_LABELS[student.bloodGroup] : null}
              />
            </Stack>

            <Divider />

            <Stack direction="row" gap={3} flexWrap="wrap">
              <Field label="Class" value={placement} />
              <Field label="Status" value={STATUS_LABELS[student.status]} />
              <Field label="Enrolled" value={formatDateOnly(student.createdAt)} />
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {/* Given its own panel and a colour: this is the one thing on the page
          someone may be reading out in a hurry. */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 3 },
          ...(student.medicalNotes ? { borderColor: 'warning.main' } : {}),
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <MedicalInformationOutlinedIcon
            sx={{ fontSize: 18, color: student.medicalNotes ? 'warning.main' : 'text.disabled' }}
          />
          <Typography variant="overline" color="text.secondary">
            Medical information
          </Typography>
        </Stack>

        <Typography
          variant="body2"
          color={student.medicalNotes ? 'text.primary' : 'text.disabled'}
          sx={{ mt: 1, whiteSpace: 'pre-wrap' }}
        >
          {student.medicalNotes ?? 'Nothing recorded.'}
        </Typography>
      </Paper>
    </Stack>
  );
}
