import { AppProviders } from '@/app/providers/AppProviders';
import { AppRouter } from '@/app/router/AppRouter';
import { useSessionRestore } from '@/features/auth';
import { useSyncThemePreference } from '@/features/profile';
import { ErrorBoundary } from '@/shared/components';

/**
 * Runs inside the providers so it can dispatch, and renders nothing — it exists
 * purely to own the session lifecycle (silent refresh on load, plus reacting to
 * the interceptor's session-expired event).
 *
 * Also applies the colour mode stored on the account once that session is known,
 * which is what carries the choice across browsers.
 */
function SessionGate() {
  useSessionRestore();
  useSyncThemePreference();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <SessionGate />
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  );
}
