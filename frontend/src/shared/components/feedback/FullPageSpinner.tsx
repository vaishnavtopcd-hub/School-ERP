import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export function FullPageSpinner() {
  return (
    <Box className="flex h-screen w-full items-center justify-center">
      <CircularProgress />
    </Box>
  );
}
