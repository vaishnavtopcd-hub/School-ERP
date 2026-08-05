import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { PropsWithChildren } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { env } from '@/config/env';
import { queryClient } from '@/shared/api';

import { store } from '../store';
import { ColorModeProvider } from '../theme/ColorModeProvider';

/**
 * Single place every global provider is composed. Order matters: router
 * outermost so any provider below it can read location, theme innermost so
 * CssBaseline applies before the first paint.
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ColorModeProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </ColorModeProvider>
        {env.enableDevtools && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ReduxProvider>
  );
}
