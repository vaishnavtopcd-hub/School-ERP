import { alpha, createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';

/** Width of the expanded navigation drawer, shared by the layout and its offsets. */
export const SIDEBAR_WIDTH = 228;
/** Width once collapsed to icons only — just wide enough for a centred icon. */
export const SIDEBAR_WIDTH_COLLAPSED = 62;
/** Height of the top application bar. */
export const TOPBAR_HEIGHT = 58;

/**
 * Brand ramp. Kept as a plain object so `tailwind.config.js` can mirror the same
 * values and neither styling system drifts from the other.
 */
const brand = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
};

/** Neutral ramp used for surfaces, borders, and body copy. */
const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

/**
 * The navigation drawer keeps a dark surface in both colour modes — it reads as
 * chrome rather than content, which is what stops it competing with the page.
 */
export const sidebarPalette = {
  /** Indigo → violet, top to bottom. The rail reads as brand, not as chrome. */
  gradient: 'linear-gradient(170deg, #1e1b4b 0%, #2e1065 52%, #4c1d95 100%)',
  /** Warm highlight bloom laid over the gradient so it never looks like flat paint. */
  bloom:
    'radial-gradient(90% 55% at 15% 0%, rgba(139, 92, 246, 0.34) 0%, transparent 62%), radial-gradient(70% 45% at 100% 100%, rgba(217, 70, 239, 0.20) 0%, transparent 70%)',
  border: 'rgba(255, 255, 255, 0.10)',
  text: 'rgba(226, 232, 240, 0.80)',
  textMuted: 'rgba(196, 181, 253, 0.62)',
  textActive: '#ffffff',
  hover: 'rgba(255, 255, 255, 0.09)',
  /** Frosted glass rather than solid fill — it sits *on* the gradient. */
  activeBg: 'rgba(255, 255, 255, 0.16)',
  activeBorder: 'rgba(255, 255, 255, 0.22)',
  activeShadow: '0 6px 18px -6px rgba(0, 0, 0, 0.55)',
  /** Panel behind the signed-in user, darkened to anchor the bottom edge. */
  footerBg: 'rgba(15, 10, 40, 0.42)',
};

/**
 * MUI's default shadow ramp is heavy for a dense admin UI. These are flatter and
 * cooler-toned so elevation reads as depth rather than as a drop shadow.
 */
function buildShadows(mode: 'light' | 'dark'): Theme['shadows'] {
  const base = mode === 'light' ? '15, 23, 42' : '0, 0, 0';
  const soft = (y: number, blur: number, spread: number, opacity: number) =>
    `0 ${y}px ${blur}px ${spread}px rgba(${base}, ${opacity})`;

  const ramp = [
    'none',
    soft(1, 2, 0, 0.06),
    soft(2, 4, -1, 0.08),
    soft(3, 6, -1, 0.1),
    soft(4, 8, -2, 0.1),
    soft(6, 12, -2, 0.12),
    soft(8, 16, -4, 0.12),
    soft(10, 20, -5, 0.14),
    soft(12, 24, -6, 0.14),
  ];

  // MUI requires exactly 25 entries; the deepest value carries the remainder.
  return Array.from(
    { length: 25 },
    (_, index) => ramp[index] ?? ramp[ramp.length - 1],
  ) as Theme['shadows'];
}

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const isLight = mode === 'light';
  const primaryMain = isLight ? brand[600] : brand[400];
  const errorMain = isLight ? '#dc2626' : '#f87171';
  const fieldBg = isLight ? slate[50] : alpha(slate[950], 0.55);
  const fieldBorder = isLight ? slate[200] : 'rgba(148, 163, 184, 0.22)';

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? brand[600] : brand[400],
        light: brand[400],
        dark: brand[700],
        contrastText: '#ffffff',
      },
      secondary: { main: '#7c3aed', light: '#a78bfa', dark: '#5b21b6' },
      success: { main: isLight ? '#059669' : '#34d399' },
      warning: { main: isLight ? '#d97706' : '#fbbf24' },
      error: { main: isLight ? '#dc2626' : '#f87171' },
      info: { main: isLight ? '#0284c7' : '#38bdf8' },
      divider: isLight ? slate[200] : 'rgba(148, 163, 184, 0.16)',
      background: isLight
        ? { default: '#f6f7fb', paper: '#ffffff' }
        : { default: '#0b1020', paper: '#141b2d' },
      text: isLight
        ? { primary: slate[900], secondary: slate[500] }
        : { primary: '#e2e8f0', secondary: slate[400] },
    },

    shape: { borderRadius: 10 },

    typography: {
      fontFamily: ['Roboto', 'system-ui', 'Segoe UI', 'sans-serif'].join(','),
      h1: { fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
      h4: { fontSize: '1.125rem', fontWeight: 600 },
      h5: { fontSize: '1rem', fontWeight: 600 },
      h6: { fontSize: '0.9375rem', fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body2: { fontSize: '0.875rem' },
      caption: { fontSize: '0.75rem' },
      overline: { fontWeight: 700, letterSpacing: '0.08em' },
      button: { textTransform: 'none', fontWeight: 600 },
    },

    shadows: buildShadows(mode),

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Scrollbars are styled to match the surface; the browser default is
          // jarring against a tinted background.
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isLight ? slate[300] : slate[700],
            borderRadius: 8,
            border: `2px solid transparent`,
            backgroundClip: 'content-box',
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor: isLight ? slate[400] : slate[600],
          },
          '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 16 },
          sizeLarge: { paddingBlock: 10 },
          containedPrimary: {
            boxShadow: `0 1px 2px 0 ${alpha(brand[900], 0.24)}`,
            '&:hover': { boxShadow: `0 2px 8px -1px ${alpha(brand[900], 0.32)}` },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: isLight ? slate[200] : 'rgba(148, 163, 184, 0.16)' },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0, variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 14 } },
      },

      MuiTextField: {
        defaultProps: { size: 'small', fullWidth: true },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: fieldBg,
            transition:
              'background-color 130ms ease, box-shadow 130ms ease, border-color 130ms ease',

            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: fieldBorder,
              transition: 'border-color 130ms ease',
            },

            // Filling in on hover/focus makes the active field obvious without
            // adding a second border weight that shifts the layout.
            '&:hover': { backgroundColor: isLight ? '#ffffff' : alpha(slate[900], 0.6) },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isLight ? slate[300] : slate[600],
            },

            '&.Mui-focused': {
              backgroundColor: isLight ? '#ffffff' : alpha(slate[900], 0.75),
              boxShadow: `0 0 0 3px ${alpha(primaryMain, 0.18)}`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 1,
              borderColor: primaryMain,
            },

            '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(errorMain, 0.18)}` },

            '&.Mui-disabled': {
              backgroundColor: isLight ? slate[100] : alpha(slate[950], 0.35),
            },
          },
          // Small is the app default; a little more height keeps it from
          // reading as cramped next to the new radius.
          inputSizeSmall: { paddingTop: 11.5, paddingBottom: 11.5 },
        },
      },

      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            '&.Mui-focused': { color: primaryMain },
          },
        },
      },

      MuiFormHelperText: {
        styleOverrides: {
          root: { marginLeft: 4, marginRight: 0, fontSize: '0.75rem', lineHeight: 1.45 },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          root: { width: 40, height: 24, padding: 0, marginRight: 8 },
          switchBase: {
            padding: 3,
            '&.Mui-checked': {
              transform: 'translateX(16px)',
              color: '#fff',
              '& + .MuiSwitch-track': { opacity: 1, backgroundColor: primaryMain },
            },
          },
          thumb: { width: 18, height: 18, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.28)' },
          track: {
            borderRadius: 12,
            opacity: 1,
            backgroundColor: isLight ? slate[300] : slate[700],
          },
        },
      },

      MuiCheckbox: {
        styleOverrides: {
          root: { borderRadius: 8, padding: 7 },
        },
      },

      MuiFormControlLabel: {
        styleOverrides: {
          label: { fontSize: '0.875rem' },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 7, fontWeight: 600, fontSize: '0.75rem' },
          sizeSmall: { height: 23 },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: { fontSize: '0.75rem', borderRadius: 6, paddingBlock: 6, paddingInline: 10 },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            minWidth: 200,
            border: `1px solid ${isLight ? slate[200] : 'rgba(148,163,184,0.16)'}`,
          },
          list: { paddingBlock: 6 },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 6,
            paddingBlock: 7,
            fontSize: '0.875rem',
          },
        },
      },

      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 16 } },
      },

      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1.125rem', fontWeight: 700, paddingBottom: 8 } },
      },

      MuiAlert: {
        styleOverrides: { root: { borderRadius: 10, alignItems: 'center' } },
      },

      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 600, color: isLight ? slate[500] : slate[400] },
        },
      },

      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 38, color: 'inherit' } },
      },

      MuiAvatar: {
        styleOverrides: { root: { fontWeight: 600 } },
      },

      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: { root: { fontWeight: 500 } },
      },
    },
  });

  return responsiveFontSizes(theme);
}

/**
 * Shared DataGrid styling. The grid sits inside an already-bordered card, so it
 * drops its own border and leans on row dividers instead.
 */
export const dataGridSx = {
  '--DataGrid-overlayHeight': '280px',
  border: 0,
  // A tinted header strip separates chrome from data without an extra rule.
  '& .MuiDataGrid-columnHeaders': {
    borderBottom: '1px solid',
    borderColor: 'divider',
  },
  '& .MuiDataGrid-columnHeader': {
    backgroundColor: 'action.hover',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontWeight: 700,
    fontSize: '0.6875rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
  },
  '& .MuiDataGrid-cell': { borderColor: 'divider' },
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
  '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
    outline: 'none',
  },
  '& .MuiDataGrid-row:hover': { backgroundColor: 'action.hover' },
  '& .MuiDataGrid-footerContainer': { borderColor: 'divider' },
} as const;

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
