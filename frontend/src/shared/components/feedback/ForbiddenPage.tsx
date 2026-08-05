import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/shared/constants';

export default function ForbiddenPage() {
  return (
    <Box className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Typography variant="h1">403</Typography>
      <Typography variant="body1" color="text.secondary">
        Your account doesn&apos;t have access to this area.
      </Typography>
      <Button component={Link} to={ROUTES.root} variant="contained">
        Back to dashboard
      </Button>
    </Box>
  );
}
