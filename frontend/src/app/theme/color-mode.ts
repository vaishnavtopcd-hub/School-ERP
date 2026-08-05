import { createContext, useContext } from 'react';

export type ColorMode = 'light' | 'dark';

export interface ColorModeContextValue {
  /** The mode actually in effect, with the OS preference already resolved. */
  mode: ColorMode;
  /** What the user pinned, or `null` when they have left it to the OS. */
  preference: ColorMode | null;
  toggle: () => void;
  /** Pins a mode; `null` clears the pin so the OS decides again. */
  setMode: (mode: ColorMode | null) => void;
}

/**
 * Split from `ColorModeProvider` so that file exports a component and nothing
 * else — mixing the two breaks Fast Refresh for the whole subtree.
 */
export const ColorModeContext = createContext<ColorModeContextValue>({
  mode: 'light',
  preference: null,
  toggle: () => undefined,
  setMode: () => undefined,
});

export function useColorMode(): ColorModeContextValue {
  return useContext(ColorModeContext);
}
