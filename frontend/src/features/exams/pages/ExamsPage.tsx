import AddIcon from '@mui/icons-material/Add';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { PageHeader } from '@/shared/components';
import { ROUTES } from '@/shared/constants';
import { useDebounce } from '@/shared/hooks';
import { formatDateOnly } from '@/shared/utils';

import { ExamFormDialog } from '../components/ExamFormDialog';
import { useExamsList } from '../hooks/useExams';
import {
  EXAM_STATUSES,
  EXAM_STATUS_COLORS,
  EXAM_STATUS_LABELS,
  EXAM_TYPES,
  EXAM_TYPE_LABELS,
  type ExamStatus,
  type ExamType,
  type ListExamsParams,
} from '../types';

/** The examination calendar: what is being planned, and what has been announced. */
export default function ExamsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [status, setStatus] = useState<ExamStatus | ''>('');
  const [type, setType] = useState<ExamType | ''>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [createOpen, setCreateOpen] = useState(false);

  const params = useMemo<ListExamsParams>(
    () => ({
      // The table is 0-based; the API is 1-based.
      page: page + 1,
      limit: pageSize,
      search: search || undefined,
      status: status || undefined,
      type: type || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    [page, pageSize, search, status, type],
  );

  const { data, isFetching, error } = useExamsList(params);

  const listError = error instanceof ApiError ? error : null;
  const rows = data?.items ?? [];

  return (
    <Box>
      <PageHeader
        breadcrumb="Academics"
        title="Examinations"
        subtitle="Set an exam, schedule its papers, then announce it to the school."
        actions={
          hasPermission('exam:create') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Set an exam
            </Button>
          )
        }
      />

      {listError && (
        <Alert severity="error" className="mb-4">
          {listError.message}
        </Alert>
      )}

      <Paper elevation={0} variant="outlined">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={1.5}
          alignItems={{ sm: 'center' }}
          className="p-4"
        >
          <TextField
            label="Search"
            placeholder="Exam or class name"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
          />

          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ExamStatus | '');
              setPage(0);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">
              <em>All statuses</em>
            </MenuItem>
            {EXAM_STATUSES.map((option) => (
              <MenuItem key={option} value={option}>
                {EXAM_STATUS_LABELS[option]}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as ExamType | '');
              setPage(0);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">
              <em>All types</em>
            </MenuItem>
            {EXAM_TYPES.map((option) => (
              <MenuItem key={option} value={option}>
                {EXAM_TYPE_LABELS[option]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Divider />

        <Box sx={{ position: 'relative' }}>
          {isFetching && (
            <LinearProgress
              sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 2, height: 2 }}
            />
          )}

          <TableContainer>
            <Table
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
                  <TableCell>Exam</TableCell>
                  <TableCell width={140}>Type</TableCell>
                  <TableCell width={150}>Class</TableCell>
                  <TableCell width={210}>Schedule</TableCell>
                  <TableCell width={130}>Status</TableCell>
                  <TableCell width={56} />
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.length === 0 && !isFetching && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ borderBottom: 0 }}>
                      <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                        <AssignmentOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                        <Typography variant="subtitle2" color="text.secondary">
                          {search || status || type ? 'No matching exams' : 'No exams yet'}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {search || status || type
                            ? 'Try a different search term or clear the filters.'
                            : 'Set one, schedule its papers, then announce it.'}
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => navigate(ROUTES.exams.detail(row.id))}
                    sx={{ cursor: 'pointer', '& > .MuiTableCell-root': { py: 1.5 } }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {row.name}
                      </Typography>
                      {row.academicYearName && (
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {row.academicYearName}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip label={EXAM_TYPE_LABELS[row.type]} size="small" variant="outlined" />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{row.className}</Typography>
                    </TableCell>

                    {/* Papers and their span answer "is this ready to
                        announce?", which is the question this list exists for. */}
                    <TableCell>
                      {row.paperCount === 0 ? (
                        <Typography variant="body2" color="text.disabled">
                          Nothing scheduled
                        </Typography>
                      ) : (
                        <Box>
                          <Typography variant="body2">
                            {row.paperCount} paper{row.paperCount === 1 ? '' : 's'}
                          </Typography>
                          {row.startsOn && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              component="div"
                            >
                              {formatDateOnly(row.startsOn)}
                              {row.endsOn && row.endsOn !== row.startsOn
                                ? ` – ${formatDateOnly(row.endsOn)}`
                                : ''}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={EXAM_STATUS_LABELS[row.status]}
                        color={EXAM_STATUS_COLORS[row.status]}
                        size="small"
                      />
                    </TableCell>

                    <TableCell align="right">
                      <ChevronRightIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <TablePagination
          component="div"
          count={data?.meta.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_event, next) => setPage(next)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Paper>

      <ExamFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
