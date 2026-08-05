import Typography from '@mui/material/Typography';

import { formatDateOnly, formatDateTime } from '@/shared/utils';

interface DateCellProps {
  value: string | Date | null | undefined;
  /**
   * `date` for calendar dates with no time (formatted zone-safely),
   * `datetime` for instants.
   */
  kind?: 'date' | 'datetime';
  /** Shown when the value is absent, e.g. "Never". */
  fallback?: string;
}

/**
 * A date inside a table cell.
 *
 * Two things a bare `{formatDate(x)}` in a `renderCell` does not give you:
 * the cell content is unstyled and top-aligned, so it sits off the baseline of
 * the chips and names beside it; and proportional digits make a column of dates
 * ragged, because `1` is narrower than `0`. `tabular-nums` fixes the second —
 * every figure occupies the same width, so the column reads as a column.
 */
export function DateCell({ value, kind = 'datetime', fallback = '—' }: DateCellProps) {
  const text = value ? (kind === 'date' ? formatDateOnly(value) : formatDateTime(value)) : fallback;

  return (
    <Typography
      variant="body2"
      noWrap
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        color: value ? 'text.secondary' : 'text.disabled',
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum"',
      }}
    >
      {text}
    </Typography>
  );
}
