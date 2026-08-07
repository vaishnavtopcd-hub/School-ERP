import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DirectionsBusOutlinedIcon from '@mui/icons-material/DirectionsBusOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import FamilyRestroomOutlinedIcon from '@mui/icons-material/FamilyRestroomOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { ConfirmActionDialog, PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';

import { AttendanceTab } from '../components/profile/AttendanceTab';
import { ExamsTab } from '../components/profile/ExamsTab';
import { ParentsTab } from '../components/profile/ParentsTab';
import { PendingModuleTab } from '../components/profile/PendingModuleTab';
import { ProfileTab } from '../components/profile/ProfileTab';
import { useDeleteStudent, useStudent } from '../hooks/useStudents';
import { STATUS_COLORS, STATUS_LABELS } from '../types';

const TABS = [
  'profile',
  'parents',
  'attendance',
  'exams',
  'fees',
  'transport',
  'documents',
] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  profile: 'Profile',
  parents: 'Parents',
  attendance: 'Attendance',
  exams: 'Exams',
  fees: 'Fees',
  transport: 'Bus route',
  documents: 'Documents',
};

/**
 * The five tabs whose modules do not exist yet.
 *
 * Held here as data rather than five near-identical JSX blocks, and stating
 * what each needs — this list is also the build order for those modules.
 */
const PENDING: Partial<
  Record<TabKey, { icon: typeof EventAvailableOutlinedIcon; description: string; requires: string }>
> = {
  fees: {
    icon: PaymentsOutlinedIcon,
    description: 'What has been invoiced, what has been paid, and what is outstanding.',
    requires: 'fees and invoicing are not part of the system yet.',
  },
  transport: {
    icon: DirectionsBusOutlinedIcon,
    description: 'The route this student travels, their stop, and the pick-up and drop times.',
    requires: 'transport and routes are not part of the system yet.',
  },
  documents: {
    icon: FolderOutlinedIcon,
    description:
      'Birth certificate, transfer certificate, and anything else held on file for this student.',
    requires: 'document storage is not part of the system yet.',
  },
};

const TAB_ICONS: Record<TabKey, typeof BadgeOutlinedIcon> = {
  profile: BadgeOutlinedIcon,
  parents: FamilyRestroomOutlinedIcon,
  attendance: EventAvailableOutlinedIcon,
  exams: AssignmentOutlinedIcon,
  fees: PaymentsOutlinedIcon,
  transport: DirectionsBusOutlinedIcon,
  documents: FolderOutlinedIcon,
};

const isTabKey = (value: string | null): value is TabKey =>
  Boolean(value) && (TABS as readonly string[]).includes(value as string);

/**
 * One student's profile.
 *
 * Tabs live in the query string rather than component state, so a tab is a
 * link: reloadable, shareable, and survivable by the back button.
 */
export default function StudentProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: TabKey = isTabKey(requested) ? requested : 'profile';

  const { data: student, isLoading, error } = useStudent(id);
  const deleteStudent = useDeleteStudent();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const canUpdate = hasPermission('student:update');
  const loadError = error instanceof ApiError ? error : null;

  if (isLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (loadError || !student) {
    return (
      <Box>
        <PageHeader breadcrumb="Administration · Students" title="Student" />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate(ROUTES.students.list)}>
              Back to register
            </Button>
          }
        >
          {loadError?.message ?? 'That student could not be found.'}
        </Alert>
      </Box>
    );
  }

  const pending = PENDING[tab];

  return (
    <Box>
      <PageHeader
        breadcrumb="Administration · Students"
        title={`${student.firstName} ${student.lastName}`}
        subtitle={
          student.className
            ? `${student.admissionNo} · ${student.className}${student.sectionName ? ` — ${student.sectionName}` : ''}`
            : `${student.admissionNo} · Not placed`
        }
        meta={
          <Chip
            label={STATUS_LABELS[student.status]}
            color={STATUS_COLORS[student.status]}
            size="small"
          />
        }
        actions={
          <>
            <Button
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(ROUTES.students.list)}
            >
              Register
            </Button>
            {canUpdate && (
              <Button
                variant="contained"
                startIcon={<EditOutlinedIcon />}
                onClick={() => navigate(ROUTES.students.edit(student.id))}
              >
                Edit
              </Button>
            )}
          </>
        }
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_event, next: TabKey) =>
            // `replace` so tabbing around does not build a back-button trail
            // the user has to climb out of to leave the student.
            setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true })
          }
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((key) => {
            const Icon = TAB_ICONS[key];
            return (
              <Tab
                key={key}
                value={key}
                label={TAB_LABELS[key]}
                icon={<Icon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                sx={{ minHeight: 48 }}
              />
            );
          })}
        </Tabs>
      </Box>

      {tab === 'profile' && <ProfileTab student={student} />}

      {tab === 'parents' && (
        <ParentsTab
          student={student}
          canEdit={canUpdate}
          onManage={() => navigate(ROUTES.students.edit(student.id))}
        />
      )}

      {tab === 'exams' &&
        (hasPermission('exam:read') ? (
          <ExamsTab classId={student.classId} className={student.className} />
        ) : (
          <Alert severity="info">
            You do not have permission to see the examination calendar. Ask an administrator for
            <code> exam:read</code>.
          </Alert>
        ))}

      {tab === 'attendance' &&
        (hasPermission('attendance:read') ? (
          <AttendanceTab studentId={student.id} />
        ) : (
          <Alert severity="info">
            You do not have permission to see the register. Ask an administrator for
            <code> attendance:read</code>.
          </Alert>
        ))}

      {pending && (
        <PendingModuleTab
          icon={pending.icon}
          title={`${TAB_LABELS[tab]} summary`}
          description={pending.description}
          requires={pending.requires}
        />
      )}

      {tab === 'profile' && hasPermission('student:delete') && (
        <Box sx={{ mt: 2.5 }}>
          <Button
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setConfirmDelete(true)}
          >
            Delete student
          </Button>
        </Box>
      )}

      <ConfirmActionDialog
        open={confirmDelete}
        title="Delete student"
        confirmLabel="Delete"
        destructive
        isPending={deleteStudent.isPending}
        error={deleteStudent.error}
        body={
          <>
            Delete{' '}
            <strong>
              {student.firstName} {student.lastName}
            </strong>{' '}
            ({student.admissionNo})? Their guardian links go too — the guardians themselves are
            kept. Set the status to <strong>Transferred</strong> or <strong>Graduated</strong>{' '}
            instead to retain the record.
          </>
        }
        onConfirm={() =>
          deleteStudent.mutate(student.id, {
            onSuccess: () => navigate(ROUTES.students.list, { replace: true }),
          })
        }
        onClose={() => {
          setConfirmDelete(false);
          deleteStudent.reset();
        }}
      />
    </Box>
  );
}
