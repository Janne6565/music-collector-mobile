import { useEffect } from "react";
import { refreshSession } from "@/api/client";
import { fetchAccount } from "@/api/auth";
import { useStore } from "@/local/StoreProvider";
import { useAppDispatch } from "@/store/hooks";
import { signedIn, signedOut } from "@/store/authSlice";

/**
 * Reads the session back out of the keychain, once, when the app starts.
 *
 * It sits at the root rather than on the account screen because the account screen is a
 * tab, and a tab is not mounted until it is opened. Restoring there meant the Friends tab
 * asked whether it was signed in before anything had looked, got "no", and gated its
 * queries off for the rest of the launch — the signed-out screen on a signed-in phone.
 *
 * Renders nothing: this is a side effect on the session, not a piece of the tree.
 */
export function RestoreSession() {
  const { store } = useStore();
  const dispatch = useAppDispatch();

  useEffect(() => {
    void (async () => {
      // Never blocks the UI: the app is fully usable with no account, so a slow or absent
      // network must not gate anything.
      const token = await refreshSession();
      if (token === null) {
        dispatch(signedOut());
        return;
      }
      try {
        const me = await fetchAccount();
        const hasLocalCollection = (await store.listCopies()).length > 0;
        const hasSyncedBefore = (await store.readSyncCursor()) > 0;
        dispatch(
          signedIn({ user: me, firstSyncPending: hasLocalCollection && !hasSyncedBefore }),
        );
      } catch {
        dispatch(signedOut());
      }
    })();
  }, [dispatch, store]);

  return null;
}
