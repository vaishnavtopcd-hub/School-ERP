import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface StatSegment {
  label: string;
  value: number;
  /** Resolved CSS colour — the bar and the row accent share it. */
  color: string;
}

export interface StatCardProps {
  label: string;
  value: number | null;
  /** Explains what the number counts; surfaced on the ⓘ affordance. */
  info?: string;
  segments?: StatSegment[];
  /** Shown in place of the breakdown when there is nothing to break down. */
  emptyHint?: string;
  loading?: boolean;
}

const numberFormat = new Intl.NumberFormat('en-IN');

/**
 * Headline number with a proportional breakdown. The bar and the rows read the
 * same segments, so the picture and the figures cannot drift apart.
 */
export function StatCard({
  label,
  value,
  info,
  segments = [],
  emptyHint,
  loading = false,
}: StatCardProps) {
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <Card
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
      }}
    >
      {/* --- Heading -------------------------------------------------------- */}
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1.25 }}>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>

        {info && (
          <Tooltip title={info}>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Stack>

      {/* --- Headline ------------------------------------------------------- */}
      {loading ? (
        <Skeleton width={110} height={44} />
      ) : (
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>
          {value === null ? '—' : numberFormat.format(value)}
        </Typography>
      )}

      {/* --- Proportional bar ----------------------------------------------- */}
      <Box
        sx={{
          display: 'flex',
          gap: '2px',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          mt: 1.25,
          mb: 1.5,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.07),
        }}
      >
        {!loading &&
          visible.map((segment) => (
            <Box
              key={segment.label}
              sx={{
                flexGrow: segment.value,
                flexBasis: 0,
                bgcolor: segment.color,
                transition: 'flex-grow 300ms ease',
              }}
            />
          ))}
      </Box>

      {/* --- Breakdown ------------------------------------------------------- */}
      <Stack gap={0.75} sx={{ mt: 'auto' }}>
        {loading ? (
          <>
            <Skeleton height={22} />
            <Skeleton height={22} />
          </>
        ) : segmentTotal === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {emptyHint ?? 'Nothing to break down yet.'}
          </Typography>
        ) : (
          segments.map((segment) => (
            <Stack
              key={segment.label}
              direction="row"
              alignItems="center"
              gap={1}
              sx={{
                px: 1,
                py: 0.625,
                borderRadius: 1.5,
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.035),
              }}
            >
              <Box
                sx={{
                  width: 3,
                  height: 14,
                  borderRadius: 2,
                  flexShrink: 0,
                  bgcolor: segment.color,
                }}
              />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                {numberFormat.format(segment.value)}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {segment.label}
              </Typography>
            </Stack>
          ))
        )}
      </Stack>
    </Card>
  );
}
