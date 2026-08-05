import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Fragment, useState } from 'react';

import type { SchoolClass, Section } from '../types';
import { SectionsPanel } from './SectionsPanel';

/** Kept in one place so the detail row and empty state stay in step with the head. */
const COLUMN_COUNT = 7;

/**
 * Table chrome, mirroring the DataGrid styling used on the Users page so a
 * hand-rolled table and a grid read as the same component. Local rather than a
 * shared theme export because this is the only table that needs it — DataGrid
 * covers every other list, and its row expansion is a Pro-only feature.
 */
const tableSx = {
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
  // Right-aligned counts line up digit-for-digit down the column.
  '& .MuiTableCell-root[align="right"]': { fontVariantNumeric: 'tabular-nums' },
} as const;

interface ClassesTableProps {
  rows: SchoolClass[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  canEdit: boolean;
  canDelete: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenActions: (schoolClass: SchoolClass, anchor: HTMLElement) => void;
  onAddSection: (schoolClass: SchoolClass) => void;
  onEditSection: (schoolClass: SchoolClass, section: Section) => void;
  onDeleteSection: (schoolClass: SchoolClass, section: Section) => void;
}

/**
 * Expandable master-detail table.
 *
 * A plain table rather than DataGrid: row expansion (`getDetailPanelContent`)
 * is a DataGrid Pro feature, and a school has on the order of a dozen classes,
 * so the grid's virtualisation buys nothing here. Pagination and sorting stay
 * server-driven, with sorting owned by the page toolbar — the default sort is
 * `level`, which is a derived ordering key with no column to click.
 */
export function ClassesTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  canEdit,
  canDelete,
  onPageChange,
  onPageSizeChange,
  onOpenActions,
  onAddSection,
  onEditSection,
  onDeleteSection,
}: ClassesTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <Box>
      {/* Overlaid rather than stacked above the table: an in-flow progress bar
          shifts every row down each time a query refetches. */}
      <Box sx={{ position: 'relative' }}>
        {loading && (
          <LinearProgress
            sx={{ position: 'absolute', inset: '0 0 auto 0', zIndex: 2, height: 2 }}
          />
        )}

        <TableContainer>
          <Table sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell width={52} />
                <TableCell>Class</TableCell>
                <TableCell width={160}>Medium</TableCell>
                <TableCell width={110} align="right">
                  Sections
                </TableCell>
                <TableCell width={120} align="right">
                  Capacity
                </TableCell>
                <TableCell width={120}>Status</TableCell>
                <TableCell width={60} align="right" />
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} sx={{ borderBottom: 0 }}>
                    <Stack alignItems="center" gap={1} sx={{ py: 7 }}>
                      <MeetingRoomOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
                      <Typography variant="subtitle2" color="text.secondary">
                        No classes yet
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Classes you create for this academic year will appear here.
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}

              {rows.map((row) => {
                const isOpen = expanded.has(row.id);
                const hasInactiveSections = row.sections.some((section) => !section.isActive);

                // Division and medium live on the section, so the class row
                // summarises which mediums it spans.
                const mediums = [
                  ...new Set(
                    row.sections
                      .map((section) => section.medium?.name)
                      .filter((name): name is string => Boolean(name)),
                  ),
                ];

                return (
                  <Fragment key={row.id}>
                    <TableRow
                      hover
                      sx={{
                        // An expanded row is tinted and drops its rule so it
                        // reads as one block with the panel beneath it.
                        ...(isOpen && { backgroundColor: 'action.hover' }),
                        '& > .MuiTableCell-root': {
                          py: 1.25,
                          ...(isOpen && { borderBottomColor: 'transparent' }),
                        },
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          aria-label={isOpen ? `Collapse ${row.name}` : `Expand ${row.name}`}
                          aria-expanded={isOpen}
                          onClick={() => toggle(row.id)}
                        >
                          {/* One rotating chevron instead of swapping two icons —
                              the movement shows the row opening. */}
                          <KeyboardArrowRightIcon
                            fontSize="small"
                            sx={{
                              transition: 'transform 160ms ease',
                              transform: isOpen ? 'rotate(90deg)' : 'none',
                            }}
                          />
                        </IconButton>
                      </TableCell>

                      {/* Icon tile plus a secondary line: the class reads as one
                          object rather than a name floating in a cell. */}
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              flexShrink: 0,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              color: row.isActive ? 'primary.main' : 'text.disabled',
                              bgcolor: (theme) =>
                                alpha(
                                  row.isActive
                                    ? theme.palette.primary.main
                                    : theme.palette.text.disabled,
                                  0.12,
                                ),
                            }}
                          >
                            <MeetingRoomOutlinedIcon sx={{ fontSize: 17 }} />
                          </Box>

                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {row.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              component="div"
                            >
                              {row.sectionCount === 0
                                ? 'No sections'
                                : `${row.sectionCount} section${row.sectionCount === 1 ? '' : 's'}`}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        {mediums.length > 0 ? (
                          <Stack direction="row" gap={0.5} flexWrap="wrap">
                            {mediums.map((name) => (
                              <Chip key={name} label={name} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={row.sectionCount ? 'inherit' : 'text.disabled'}
                        >
                          {row.sectionCount}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        {/* The asterisk replaces an inline "(active only)" note
                            that wrapped the column onto a second line. */}
                        <Tooltip
                          title={hasInactiveSections ? 'Counts active sections only' : ''}
                          disableHoverListener={!hasInactiveSections}
                        >
                          <Typography
                            variant="body2"
                            component="span"
                            color={row.totalCapacity ? 'inherit' : 'text.disabled'}
                          >
                            {row.totalCapacity}
                            {hasInactiveSections && (
                              <Box component="span" sx={{ color: 'text.disabled' }}>
                                {' *'}
                              </Box>
                            )}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={row.isActive ? 'Active' : 'Inactive'}
                          color={row.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>

                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={`Actions for ${row.name}`}
                          onClick={(event) => onOpenActions(row, event.currentTarget)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell
                        colSpan={COLUMN_COUNT}
                        sx={{
                          p: 0,
                          borderBottom: isOpen ? '1px solid' : 0,
                          borderColor: 'divider',
                        }}
                      >
                        <Collapse in={isOpen} unmountOnExit>
                          <SectionsPanel
                            schoolClass={row}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onAdd={onAddSection}
                            onEdit={onEditSection}
                            onDelete={onDeleteSection}
                          />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_event, next) => onPageChange(next)}
        onRowsPerPageChange={(event) => onPageSizeChange(Number(event.target.value))}
        sx={{ borderTop: '1px solid', borderColor: 'divider' }}
      />
    </Box>
  );
}
