import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { ColorModeContext, type ColorMode } from './color-mode';
import { buildTheme } from './index';

const STORAGE_KEY = 'school-erp:color-mode';

/** A stored choice wins; otherwise the OS preference decides the first paint. */
function readStoredMode(): ColorMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Private-mode browsers can throw on storage access; the OS default is fine.
    return null;
  }
}

/**
 * localStorage is still written even though the choice is also saved to the
 * user's account: it is what makes the *first* paint after a reload correct,
 * before the session has been restored and the server's answer is known.
 */
function writeStoredMode(mode: ColorMode | null): void {
  try {
    if (mode === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    // Preference simply won't persist locally; not worth surfacing.
  }
}

export function ColorModeProvider({ children }: PropsWithChildren) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const [preference, setPreference] = useState<ColorMode | null>(readStoredMode);

  const resolved: ColorMode = preference ?? (prefersDark ? 'dark' : 'light');

  const setMode = useCallback((next: ColorMode | null) => {
    writeStoredMode(next);
    setPreference(next);
  }, []);

  const toggle = useCallback(() => {
    setPreference((current) => {
      const next: ColorMode =
        (current ?? (prefersDark ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark';
      writeStoredMode(next);
      return next;
    });
  }, [prefersDark]);

  // Keeps the browser's own UI (form controls, scrollbars) in the same mode.
  useEffect(() => {
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const theme = useMemo(() => buildTheme(resolved), [resolved]);
  const value = useMemo(
    () => ({ mode: resolved, preference, toggle, setMode }),
    [resolved, preference, toggle, setMode],
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
