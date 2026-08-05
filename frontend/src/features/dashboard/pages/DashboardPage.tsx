import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  useAcademicYearsList,
  useActiveAcademicYear,
} from '@/features/academic-years/hooks/useAcademicYears';
import { useAuth } from '@/features/auth';
import { useClassesList } from '@/features/classes/hooks/useClasses';
import { useUsersList } from '@/features/users/hooks/useUsers';
import { STATUS_COLORS, STATUS_LABELS } from '@/features/users/types';
import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';
import { formatDateOnly, fullName, initials } from '@/shared/utils';

import { StatCard } from '../components/StatCard';

/** Greeting keyed off the local clock — a small touch that makes the shell feel live. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** How far through the session we are, as a percentage clamped to 0–100. */
function yearProgress(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const theme = useTheme();

  const canReadUsers = hasPermission('user:read');
  const canReadYears = hasPermission('academic-year:read');
  const canReadClasses = hasPermission('class:read');

  const { data: activeYear, isLoading: yearLoading } = useActiveAcademicYear();

  // --- Users -------------------------------------------------------------
  // Counts come from `meta.total` on filtered queries rather than from tallying
  // one page, so they stay right past the first page of results.
  const recentUsersQuery = useUsersList(
    { page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
    canReadUsers,
  );
  const activeUsers = useUsersList({ page: 1, limit: 1, status: 'ACTIVE' }, canReadUsers);
  const disabledUsers = useUsersList({ page: 1, limit: 1, status: 'INACTIVE' }, canReadUsers);
  const suspendedUsers = useUsersList({ page: 1, limit: 1, status: 'SUSPENDED' }, canReadUsers);

  // --- Academic years -----------------------------------------------------
  const yearsQuery = useAcademicYearsList({ page: 1, limit: 100 }, canReadYears);

  const yearStats = useMemo(() => {
    const items = yearsQuery.data?.items ?? [];
    return {
      total: yearsQuery.data?.meta.total ?? 0,
      active: items.filter((year) => year.status === 'ACTIVE').length,
      upcoming: items.filter((year) => year.status === 'UPCOMING').length,
      archived: items.filter((year) => year.status === 'ARCHIVED').length,
    };
  }, [yearsQuery.data]);

  // --- Classes ------------------------------------------------------------
  // Held back until a year is active: the classes endpoint 400s without one.
  const classesQuery = useClassesList(
    { page: 1, limit: 100, sortBy: 'level', sortOrder: 'asc' },
    canReadClasses && Boolean(activeYear),
  );

  const classStats = useMemo(() => {
    const items = classesQuery.data?.items ?? [];
    const sections = items.flatMap((item) => item.sections);

    return {
      total: classesQuery.data?.meta.total ?? 0,
      active: items.filter((item) => item.isActive).length,
      inactive: items.filter((item) => !item.isActive).length,
      sections: sections.length,
      activeSections: sections.filter((section) => section.isActive).length,
      inactiveSections: sections.filter((section) => !section.isActive).length,
      capacity: items.reduce((sum, item) => sum + item.totalCapacity, 0),
    };
  }, [classesQuery.data]);

  const recentUsers = recentUsersQuery.data?.items ?? [];
  const usersLoading =
    recentUsersQuery.isLoading || activeUsers.isLoading || disabledUsers.isLoading;
  const classesLoading = classesQuery.isLoading;

  return (
    <Box>
      <PageHeader
        breadcrumb="Overview"
        title={`${greeting()}, ${user?.firstName ?? 'there'}`}
        subtitle={new Intl.DateTimeFormat('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(new Date())}
      />

      {/* --- Headline numbers ------------------------------------------------ */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {canReadUsers && (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Users"
              info="Every account that can sign in, excluding deleted ones."
              value={recentUsersQuery.data?.meta.total ?? null}
              loading={usersLoading}
              segments={[
                {
                  label: 'Active',
                  value: activeUsers.data?.meta.total ?? 0,
                  color: theme.palette.success.main,
                },
                {
                  label: 'Disabled',
                  value: disabledUsers.data?.meta.total ?? 0,
                  color: theme.palette.text.disabled,
                },
                {
                  label: 'Suspended',
                  value: suspendedUsers.data?.meta.total ?? 0,
                  color: theme.palette.error.main,
                },
              ]}
            />
          </Grid>
        )}

        {canReadYears && (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              label="Academic years"
              info="Exactly one year may be active per school."
              value={yearStats.total}
              loading={yearsQuery.isLoading}
              emptyHint="No years created yet."
              segments={[
                { label: 'Active', value: yearStats.active, color: theme.palette.success.main },
                { label: 'Upcoming', value: yearStats.upcoming, color: theme.palette.info.main },
                {
                  label: 'Archived',
                  value: yearStats.archived,
                  color: theme.palette.text.disabled,
                },
              ]}
            />
          </Grid>
        )}

        {canReadClasses && (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Classes"
                info={
                  activeYear
                    ? `Classes in ${activeYear.name}. Classes belong to a year, not the school.`
                    : 'Requires an active academic year.'
                }
                value={activeYear ? classStats.total : null}
                loading={classesLoading}
                emptyHint={activeYear ? 'No classes yet.' : 'No active academic year.'}
                segments={[
                  { label: 'Active', value: classStats.active, color: theme.palette.primary.main },
                  {
                    label: 'Inactive',
                    value: classStats.inactive,
                    color: theme.palette.text.disabled,
                  },
                ]}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <StatCard
                label="Sections"
                info={`${classStats.capacity.toLocaleString('en-IN')} seats across active sections. Inactive sections are not counted.`}
                value={activeYear ? classStats.sections : null}
                loading={classesLoading}
                emptyHint={activeYear ? 'No sections yet.' : 'No active academic year.'}
                segments={[
                  {
                    label: 'Active',
                    value: classStats.activeSections,
                    color: theme.palette.secondary.main,
                  },
                  {
                    label: 'Inactive',
                    value: classStats.inactiveSections,
                    color: theme.palette.text.disabled,
                  },
                ]}
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={2}>
        {/* --- Current session ---------------------------------------------- */}
        {canReadYears && (
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="h4">Current session</Typography>
                <Button
                  component={RouterLink}
                  to={ROUTES.academicYears.list}
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                >
                  Manage
                </Button>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {yearLoading ? (
                <Stack gap={1}>
                  <Skeleton width="40%" height={32} />
                  <Skeleton width="70%" />
                  <Skeleton height={8} />
                </Stack>
              ) : activeYear ? (
                <Box>
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
                    <Typography variant="h3">{activeYear.name}</Typography>
                    <Chip label="Active" color="success" size="small" />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    {formatDateOnly(activeYear.startDate)} — {formatDateOnly(activeYear.endDate)}
                  </Typography>

                  <Box sx={{ mt: 3 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">
                        Session progress
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {Math.round(yearProgress(activeYear.startDate, activeYear.endDate))}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={yearProgress(activeYear.startDate, activeYear.endDate)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                </Box>
              ) : (
                // Everything downstream depends on this, so the empty state is a
                // call to action rather than a shrug.
                <Stack alignItems="center" gap={1.5} sx={{ py: 4, textAlign: 'center' }}>
                  <EventBusyOutlinedIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      No active academic year
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Classes and sections stay locked until a session is active.
                    </Typography>
                  </Box>
                  <Button
                    component={RouterLink}
                    to={ROUTES.academicYears.list}
                    variant="contained"
                    size="small"
                  >
                    Set up a year
                  </Button>
                </Stack>
              )}
            </Card>
          </Grid>
        )}

        {/* --- Newest accounts ---------------------------------------------- */}
        {canReadUsers && (
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Typography variant="h4">Recent users</Typography>
                <Button
                  component={RouterLink}
                  to={ROUTES.users.list}
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                >
                  View all
                </Button>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {recentUsersQuery.isLoading ? (
                <Stack gap={2}>
                  {[0, 1, 2].map((row) => (
                    <Stack key={row} direction="row" gap={1.5} alignItems="center">
                      <Skeleton variant="circular" width={36} height={36} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="60%" />
                        <Skeleton width="40%" />
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              ) : recentUsers.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                  No accounts yet.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />} gap={1.5}>
                  {recentUsers.map((entry) => (
                    <Stack key={entry.id} direction="row" gap={1.5} alignItems="center">
                      <Avatar sx={{ width: 36, height: 36, fontSize: '0.8125rem' }}>
                        {initials(entry)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {fullName(entry)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {entry.email}
                        </Typography>
                      </Box>
                      <Chip
                        label={STATUS_LABELS[entry.status]}
                        size="small"
                        color={STATUS_COLORS[entry.status]}
                        variant="outlined"
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
