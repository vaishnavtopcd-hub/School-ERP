import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from '@/features/auth/store/auth.slice';

/**
 * Redux holds client state only (session, UI preferences). Server state lives
 * in React Query — don't duplicate fetched data here.
 *
 * Feature slices register in `reducer` below.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Feature slices go here, e.g.:  ui: uiReducer,
  },
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
