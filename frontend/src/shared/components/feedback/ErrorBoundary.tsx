import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

import { env } from '@/config/env';

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes so a single broken component doesn't blank the
 * whole app. Wrap feature subtrees with their own boundary to contain failures
 * further.
 *
 * Note: React error boundaries do not catch async or event-handler errors —
 * those still need explicit try/catch.
 */
export class ErrorBoundary extends Component<PropsWithChildren<{ fallback?: ReactNode }>, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace with the real reporter (Sentry et al.) once one is wired up.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback;

    return (
      <Box className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <Alert severity="error" className="max-w-xl">
          <Typography variant="h3" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body2">
            {env.isDevelopment ? error.message : 'Please try again, or reload the page.'}
          </Typography>
        </Alert>
        <Box className="flex gap-2">
          <Button variant="contained" onClick={this.handleReset}>
            Try again
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Box>
      </Box>
    );
  }
}
