import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { AccountUser } from "@/api/auth";

export type AuthStatus = "unknown" | "anonymous" | "signedIn";

/**
 * What the sign-in conflict resolved to, kept only until the shelf has said so once.
 *
 * Mirrored from the web's slice. The banner is the only undo there is (29e-5), so it has
 * to survive the sheet coming down — and it carries the ids, because a line that states a
 * number and cannot show which records it means is decoration.
 */
export interface SyncOutcome {
  readonly resolution: "MERGED" | "KEPT_LOCAL" | "KEPT_ACCOUNT" | "REVIEWED";
  readonly arrived: number;
  readonly edits: number;
  readonly ids: string[];
}

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
  readonly syncOutcome: SyncOutcome | null;
}

const initialState: AuthState = {
  status: "unknown",
  user: null,
  firstSyncPending: false,
  syncOutcome: null,
};

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
      state.syncOutcome = null;
    },
    /**
     * The account came back changed -- renamed, or its address confirmed. Nothing else
     * about the session changes, which is why one reducer covers both: the server hands
     * back the whole account either way, and the token this phone holds is untouched.
     */
    accountChanged(state, action: PayloadAction<AccountUser>) {
      state.user = action.payload;
    },
    firstSyncResolved(state) {
      state.firstSyncPending = false;
    },
    syncOutcomeRecorded(state, action: PayloadAction<SyncOutcome | null>) {
      state.syncOutcome = action.payload;
    },
    /** Dismissed, or acted on. Either way the shelf stops explaining itself. */
    syncOutcomeCleared(state) {
      state.syncOutcome = null;
    },
  },
});

export const {
  signedIn,
  signedOut,
  accountChanged,
  firstSyncResolved,
  syncOutcomeRecorded,
  syncOutcomeCleared,
} = authSlice.actions;
export default authSlice.reducer;
