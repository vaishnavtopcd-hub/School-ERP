import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { formatDateOnly } from '@/shared/utils';

import type { ExamPaper } from '../types';

interface ExamScheduleTableProps {
  papers: ExamPaper[];
  /** Supplied only while the exam is a draft the reader may edit. */
  onRemove?: (paper: ExamPaper) => void;
  isPending?: boolean;
}

/**
 * The schedule, in the order it will be sat.
 *
 * Grouped visually by day: a paper's date is printed only when it differs from
 * the row above, which is how an exam timetable is read on paper — by day, then
 * by time within it.
 */
export function ExamScheduleTable({ papers, onRemove, isPending }: ExamScheduleTableProps) {
  if (papers.length === 0) {
    return (
      <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
        <EventNoteOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
        <Typography variant="subtitle2" color="text.secondary">
          Nothing scheduled yet
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Add a paper for each subject being examined.
        </Typography>
      </Stack>
    );
  }

  return (
    <TableContainer>
      <Table
        size="small"
        sx={{
          '& .MuiTableCell-root': { borderColor: 'divider' },
          '& .MuiTableCell-head': {
            backgroundColor: 'action.hover',
            fontWeight: 700,
            fontSize: '0.6875rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell width={150}>Date</TableCell>
            <TableCell width={140}>Time</TableCell>
            <TableCell>Subject</TableCell>
            <TableCell width={130}>Venue</TableCell>
            <TableCell width={120} align="right">
              Marks
            </TableCell>
            {onRemove && <TableCell width={56} />}
          </TableRow>
        </TableHead>

        <TableBody>
          {papers.map((paper, index) => {
            const sameDayAsAbove = index > 0 && papers[index - 1].date === paper.date;

            return (
              <TableRow key={paper.id} hover>
                <TableCell sx={{ borderTop: sameDayAsAbove ? 0 : undefined }}>
                  {sameDayAsAbove ? (
                    <Typography variant="caption" color="text.disabled">
                      ″
                    </Typography>
                  ) : (
                    <Typography variant="body2" fontWeight={600}>
                      {formatDateOnly(paper.date)}
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {paper.startTime}–{paper.endTime}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {paper.subjectName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {paper.subjectCode}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography
                    variant="body2"
                    color={paper.venue ? 'text.primary' : 'text.disabled'}
                  >
                    {paper.venue ?? '—'}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2">{paper.maxMarks}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    pass {paper.passMarks}
                  </Typography>
                </TableCell>

                {onRemove && (
                  <TableCell align="right">
                    <Tooltip title="Remove paper">
                      <span>
                        <IconButton
                          size="small"
                          disabled={isPending}
                          aria-label={`Remove ${paper.subjectName}`}
                          onClick={() => onRemove(paper)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {papers.length} paper{papers.length === 1 ? '' : 's'} scheduled.
        </Typography>
      </Box>
    </TableContainer>
  );
}
