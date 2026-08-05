import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { tokenStorage } from '@/shared/api/token-storage';
import type { AuthUser } from '@/shared/types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * True until the silent-refresh attempt on app start has settled. Routes must
   * wait for this, or a reload would bounce a signed-in user to the login page.
   */
  isInitializing: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitializing: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionEstablished(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isInitializing = false;
    },
    sessionEnded(state) {
      tokenStorage.clear();
      state.user = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
    },
    initializationFinished(state) {
      state.isInitializing = false;
    },
  },
});

export const { sessionEstablished, sessionEnded, initializationFinished } = authSlice.actions;

export const authReducer = authSlice.reducer;
