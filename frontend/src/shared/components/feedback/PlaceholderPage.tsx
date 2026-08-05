import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

/** Stand-in for routes whose feature module hasn't been built yet. */
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box className="p-6">
      <Paper className="p-8" elevation={0} variant="outlined">
        <Typography variant="h2" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This module has not been implemented yet.
        </Typography>
      </Paper>
    </Box>
  );
}
