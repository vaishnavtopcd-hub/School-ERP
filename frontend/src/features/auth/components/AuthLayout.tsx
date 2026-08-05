import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { PropsWithChildren, ReactNode } from 'react';

import { sidebarPalette as sidebar } from '@/app/theme';
import { env } from '@/config/env';

interface AuthLayoutProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

const HIGHLIGHTS = [
  'Role-based access down to each action',
  'Sessions that end the moment you revoke them',
  'One place for years, classes, and people',
];

/**
 * Split screen shared by every unauthenticated screen: a brand panel on the
 * left from `md` up, the form on the right. Below `md` the panel is dropped
 * rather than stacked — on a phone it would push the form below the fold.
 */
export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* --- Brand panel ---------------------------------------------------- */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '45%',
          maxWidth: 560,
          p: 6,
          color: '#fff',
          // Same ramp as the navigation drawer, so signing in and landing on
          // the dashboard feel like one product rather than two.
          background: sidebar.gradient,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: sidebar.bloom,
            pointerEvents: 'none',
          },
          // Soft light source in the corner keeps the gradient from looking flat.
          '&::after': {
            content: '""',
            position: 'absolute',
            top: -120,
            right: -120,
            width: 380,
            height: 380,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 70%)',
          },
          // Both pseudo-elements are positioned, so content has to be lifted
          // explicitly or the bloom paints over it.
          '& > *': { position: 'relative', zIndex: 1 },
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,0.16)',
            }}
          >
            <SchoolRoundedIcon sx={{ fontSize: 23 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem' }}>{env.appName}</Typography>
        </Stack>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h1" sx={{ fontSize: '2.25rem', mb: 2, lineHeight: 1.2 }}>
            Run your school
            <br />
            from one place.
          </Typography>

          <Stack gap={1.5} sx={{ mt: 4 }}>
            {HIGHLIGHTS.map((line) => (
              <Stack key={line} direction="row" gap={1.25} alignItems="center">
                <CheckCircleOutlineIcon sx={{ fontSize: 19, opacity: 0.9 }} />
                <Typography variant="body2" sx={{ opacity: 0.92 }}>
                  {line}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          © {new Date().getFullYear()} {env.appName}
        </Typography>
      </Box>

      {/* --- Form ------------------------------------------------------------ */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: { xs: 3, sm: 4.5 },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 4,
          }}
        >
          {/* The brand panel is hidden on small screens, so the mark repeats here. */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 1.25,
              mb: 3,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              }}
            >
              <SchoolRoundedIcon sx={{ fontSize: 20, color: '#fff' }} />
            </Box>
            <Typography sx={{ fontWeight: 700 }}>{env.appName}</Typography>
          </Box>

          <Box component="header" sx={{ mb: 3 }}>
            <Typography variant="h2" component="h1">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {children}

          {footer && <Box sx={{ mt: 3, textAlign: 'center' }}>{footer}</Box>}
        </Paper>
      </Box>
    </Box>
  );
}
