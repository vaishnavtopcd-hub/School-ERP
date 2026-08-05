import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/shared/constants';

export default function NotFoundPage() {
  return (
    <Box className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Typography variant="h1">404</Typography>
      <Typography variant="body1" color="text.secondary">
        We couldn&apos;t find that page.
      </Typography>
      <Button component={Link} to={ROUTES.root} variant="contained">
        Back to dashboard
      </Button>
    </Box>
  );
}
