import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

import { AppDialog } from '@/shared/components';

import { useCreatePeriod, useDeletePeriod, usePeriods } from '../hooks/useTimetable';

interface PeriodsDialogProps {
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
}

/** Adds 45 minutes to `HH:mm`, so the end time is usually already right. */
function plusMinutes(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The school day, defined once and shared by every class.
 *
 * A dialog rather than a page: it is set up at the start of a year and then
 * left alone, and it is only ever wanted from the timetable itself.
 */
export function PeriodsDialog({ open, canEdit, onClose }: PeriodsDialogProps) {
  const { data: periods = [] } = usePeriods(open);

  const createPeriod = useCreatePeriod();
  const deletePeriod = useDeletePeriod();

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:45');
  const [isBreak, setIsBreak] = useState(false);

  const pending = createPeriod.isPending || deletePeriod.isPending;
  const error = createPeriod.error ?? deletePeriod.error;

  const nextSequence = periods.reduce((max, period) => Math.max(max, period.sequence), 0) + 1;

  const add = () => {
    createPeriod.mutate(
      { name: name.trim(), sequence: nextSequence, startTime, endTime, isBreak },
      {
        onSuccess: () => {
          setName('');
          setIsBreak(false);
          // Chain the next period onto the end of this one — a school day is a
          // sequence, and typing the same times twice is the common case.
          setStartTime(endTime);
          setEndTime(plusMinutes(endTime, 45));
        },
      },
    );
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="The school day"
      subtitle="One ladder of periods, shared by every class."
      icon={ScheduleOutlinedIcon}
      maxWidth="sm"
      error={error}
      confirmLabel="Done"
      cancelLabel="Close"
      onConfirm={onClose}
    >
      {periods.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No periods yet. Add them in the order they run — the first one you add is period 1.
        </Typography>
      ) : (
        <Stack>
          {periods.map((period) => (
            <Stack
              key={period.id}
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
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ width: 20, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
              >
                {period.sequence}
              </Typography>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {period.name}
                  </Typography>
                  {period.isBreak && <Chip label="Break" size="small" variant="outlined" />}
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">
                  {period.startTime}–{period.endTime}
                </Typography>
              </Box>

              {canEdit && (
                <Tooltip title="Remove">
                  <span>
                    <IconButton
                      size="small"
                      disabled={pending}
                      aria-label={`Remove ${period.name}`}
                      onClick={() => deletePeriod.mutate(period.id)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      {canEdit && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="flex-start">
            <TextField
              size="small"
              label="Name"
              placeholder={`Period ${nextSequence}`}
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <TextField
              size="small"
              label="Start"
              type="time"
              value={startTime}
              disabled={pending}
              onChange={(event) => setStartTime(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 120 }}
            />
            <TextField
              size="small"
              label="End"
              type="time"
              value={endTime}
              disabled={pending}
              onChange={(event) => setEndTime(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 120 }}
            />
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={isBreak}
                  disabled={pending}
                  onChange={(event) => setIsBreak(event.target.checked)}
                />
              }
              label={
                <Typography variant="body2">Break — shown in the grid, never scheduled</Typography>
              }
            />

            <Button
              type="button"
              startIcon={<AddIcon />}
              disabled={!name.trim() || pending}
              onClick={add}
            >
              Add
            </Button>
          </Stack>

          <Alert severity="info" variant="outlined">
            <Typography variant="caption">
              Every class shares this ladder — that is what makes &ldquo;is this teacher free in
              period 3?&rdquo; a question with one answer. A period holding lessons cannot be
              removed until they are cleared.
            </Typography>
          </Alert>
        </>
      )}
    </AppDialog>
  );
}
