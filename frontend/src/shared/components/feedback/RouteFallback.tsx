import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Suspense fallback for a lazily-loaded page *inside* the app shell.
 *
 * Deliberately not full-height: the sidebar and top bar stay mounted while a
 * route chunk loads, so only the content region shows a spinner. A viewport
 * -sized fallback here would blank the whole screen and read as a page reload.
 */
export function RouteFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Roughly a page's worth of height, so the shell does not jump when the
        // real content replaces the spinner.
        minHeight: '55vh',
      }}
    >
      <CircularProgress size={32} />
    </Box>
  );
}
