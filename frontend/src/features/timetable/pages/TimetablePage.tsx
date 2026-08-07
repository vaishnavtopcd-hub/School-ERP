import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth';
import { useClassesList } from '@/features/classes/hooks/useClasses';
import { useTeachersList } from '@/features/teachers/hooks/useTeachers';
import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { MAX_PAGE_SIZE } from '@/shared/constants';

import { AssignLessonDialog } from '../components/AssignLessonDialog';
import { PeriodsDialog } from '../components/PeriodsDialog';
import { TimetableGrid } from '../components/TimetableGrid';
import { useWeeklyTimetable } from '../hooks/useTimetable';
import type { DayOfWeek, Period, TimetableEntry, TimetableScope } from '../types';

const CLASS_PARAMS = { page: 1, limit: MAX_PAGE_SIZE, sortBy: 'level', sortOrder: 'asc' } as const;
const TEACHER_PARAMS = {
  page: 1,
  limit: MAX_PAGE_SIZE,
  sortBy: 'firstName' as const,
  sortOrder: 'asc' as const,
};

/**
 * The weekly timetable, read two ways.
 *
 * **By class** is a section's week — what a class is given, and where lessons
 * are assigned. **By teacher** is a member of staff's week, read-only: a lesson
 * belongs to a section, so editing it from the teacher's side would mean
 * choosing whose week you were changing.
 */
export default function TimetablePage() {
  const { hasPermission } = useAuth();

  const [scope, setScope] = useState<TimetableScope>('section');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [slot, setSlot] = useState<{ day: DayOfWeek; period: Period } | null>(null);
  const [entry, setEntry] = useState<TimetableEntry | null>(null);

  const { data: classes } = useClassesList(CLASS_PARAMS);
  const { data: teachers } = useTeachersList(TEACHER_PARAMS);

  const classItems = useMemo(() => classes?.items ?? [], [classes]);
  const teacherItems = useMemo(() => teachers?.items ?? [], [teachers]);
  // Memoised because the auto-select effect below depends on it, and a fresh
  // array every render would re-run that effect every render.
  const sections = useMemo(
    () => classItems.find((item) => item.id === classId)?.sections ?? [],
    [classItems, classId],
  );

  // Land on a filled grid rather than three empty dropdowns: the first class,
  // its first section, and the first teacher are as good a starting point as
  // any, and every one of them is one click from being changed.
  useEffect(() => {
    if (!classId && classItems.length > 0) setClassId(classItems[0].id);
  }, [classItems, classId]);

  useEffect(() => {
    if (!sectionId && sections.length > 0) setSectionId(sections[0].id);
  }, [sections, sectionId]);

  useEffect(() => {
    if (!teacherId && teacherItems.length > 0) setTeacherId(teacherItems[0].id);
  }, [teacherItems, teacherId]);

  const query = useMemo(() => {
    if (scope === 'section') return sectionId ? { sectionId } : null;
    return teacherId ? { teacherId } : null;
  }, [scope, sectionId, teacherId]);

  const { data: week, isFetching, error } = useWeeklyTimetable(query);

  const canEditGrid = hasPermission('timetable:update') && scope === 'section';
  const loadError = error instanceof ApiError ? error : null;

  // How full the week is. Breaks are not slots anyone can fill, so they are out
  // of both halves of the count.
  const teachingPeriods = week?.periods.filter((period) => !period.isBreak).length ?? 0;
  const slots = teachingPeriods * (week?.days.length ?? 0);
  const filled = week?.entries.length ?? 0;

  const closeAssign = () => {
    setSlot(null);
    setEntry(null);
  };

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Timetable"
        subtitle="The week, period by period. A teacher cannot be in two rooms at once, and neither can a class."
        actions={
          <>
            {hasPermission('period:read') && (
              <Button
                color="inherit"
                startIcon={<ScheduleOutlinedIcon />}
                onClick={() => setPeriodsOpen(true)}
              >
                School day
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<PrintOutlinedIcon />}
              disabled={!week}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </>
        }
      />

      {loadError && (
        <Alert severity="error" className="mb-4">
          {loadError.message}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <Tabs
          value={scope}
          onChange={(_event, next: TimetableScope) => setScope(next)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            value="section"
            label="Class & section"
            icon={<ClassOutlinedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab
            value="teacher"
            label="Teacher"
            icon={<BadgeOutlinedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
        </Tabs>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1.5}
          alignItems={{ sm: 'center' }}
          sx={{ p: 2 }}
        >
          {scope === 'section' ? (
            <>
              <TextField
                select
                size="small"
                label="Class"
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  // The old section belongs to the old class; the effect above
                  // picks the new class's first one.
                  setSectionId('');
                }}
                sx={{ minWidth: 180 }}
              >
                {classItems.map((schoolClass) => (
                  <MenuItem key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Section"
                value={sectionId}
                disabled={!classId || sections.length === 0}
                onChange={(event) => setSectionId(event.target.value)}
                sx={{ minWidth: 180 }}
                helperText={
                  classId && sections.length === 0 ? 'That class has no sections.' : undefined
                }
              >
                {sections.map((section) => (
                  <MenuItem key={section.id} value={section.id}>
                    {section.name}
                    {section.division ? ` — ${section.division}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <TextField
              select
              size="small"
              label="Teacher"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              sx={{ minWidth: 260 }}
            >
              {teacherItems.map((teacher) => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {teacher.firstName} {teacher.lastName}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Box sx={{ flex: 1 }} />

          {week && slots > 0 && (
            <Stack direction="row" gap={1} alignItems="center">
              <Chip label={`${filled} scheduled`} size="small" color="primary" variant="outlined" />
              <Chip label={`${Math.max(slots - filled, 0)} free`} size="small" variant="outlined" />
            </Stack>
          )}
        </Stack>

        <Divider />

        <Box sx={{ position: 'relative' }}>
          {isFetching && (
            <LinearProgress
              sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 2, height: 2 }}
            />
          )}

          {!query ? (
            <Stack alignItems="center" gap={1} sx={{ py: 8 }}>
              <ScheduleOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
              <Typography variant="subtitle2" color="text.secondary">
                {scope === 'section' ? 'No class and section to show' : 'No teaching staff to show'}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {scope === 'section'
                  ? 'Add a class with at least one section first.'
                  : 'Add teaching staff under Teachers first.'}
              </Typography>
            </Stack>
          ) : (
            week && (
              <TimetableGrid
                periods={week.periods}
                days={week.days}
                entries={week.entries}
                scope={scope}
                canEdit={canEditGrid}
                onSelectSlot={(day, period) => {
                  setEntry(null);
                  setSlot({ day, period });
                }}
                onSelectEntry={(selected) => {
                  const period = week.periods.find((item) => item.id === selected.periodId);
                  if (!period) return;
                  setEntry(selected);
                  setSlot({ day: selected.day, period });
                }}
              />
            )
          )}
        </Box>
      </Paper>

      {/* Read-only is a property of the view, not a missing permission — say so
          rather than leaving someone clicking cells that do nothing. */}
      {scope === 'teacher' && week && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          A teacher&rsquo;s week is read-only. Lessons are assigned from the class and section it
          belongs to.
        </Typography>
      )}

      <PeriodsDialog
        open={periodsOpen}
        canEdit={hasPermission('period:update')}
        onClose={() => setPeriodsOpen(false)}
      />

      <AssignLessonDialog
        open={Boolean(slot) && scope === 'section'}
        slot={slot}
        sectionId={sectionId}
        classId={classId}
        entry={entry}
        onClose={closeAssign}
      />
    </Box>
  );
}
