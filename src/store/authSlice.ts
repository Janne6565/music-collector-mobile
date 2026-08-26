import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { AccountUser } from "@/api/auth";

export type AuthStatus = "unknown" | "anonymous" | "signedIn";

interface AuthState {
  /**
   * Starts as "unknown" rather than "anonymous": until the keychain has been read and the
   * refresh token exchanged we do not know which one is true, and showing a signed-out
   * state to a signed-in person is worse than showing nothing for a moment.
   */
  readonly status: AuthStatus;
  readonly user: AccountUser | null;
  /** Set when a signed-in device still has a local collection that has never synced. */
  readonly firstSyncPending: boolean;
}

const initialState: AuthState = { status: "unknown", user: null, firstSyncPending: false };

/**
 * The session, mirrored from the web's slice of the same name.
 *
 * It lives in Redux rather than in the account screen's own state because more than one
 * tab needs the answer: Friends gates every one of its queries on it, and that tab can be
 * opened before the account screen has ever mounted.
 */
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<{ user: AccountUser; firstSyncPending: boolean }>) {
      state.status = "signedIn";
      state.user = action.payload.user;
      state.firstSyncPending = action.payload.firstSyncPending;
    },
    signedOut(state) {
      state.status = "anonymous";
      state.user = null;
      state.firstSyncPending = false;
    },
    /** The account came back renamed. Nothing else about the session changes. */
    renamed(state, action: PayloadAction<AccountUser>) {
      state.user = action.payload;
    },
    firstSyncResolved(state) {
      state.firstSyncPending = false;
    },
  },
});

export const { signedIn, signedOut, renamed, firstSyncResolved } = authSlice.actions;
export default authSlice.reducer;
