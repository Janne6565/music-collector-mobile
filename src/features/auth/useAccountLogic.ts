import { useCallback, useEffect, useRef, useState } from "react";
import { type AccountUser, type AuthProvider, authProviders, createAccount, requestPasswordReset, signIn, signOut } from "@/api/auth";
import { refreshSession } from "@/api/client";
import { useStore } from "@/local/StoreProvider";
import { type FirstSyncStrategy, SyncEngine } from "@/sync/syncEngine";

export type AuthMode = "SIGN_IN" | "REGISTER";
export type AuthError = "badCredentials" | "emailTaken" | "generic";

/** Reconcile with the server this often while the app is open and signed in. */
const SYNC_INTERVAL_MS = 60_000;

export function useAccountLogic() {
  const { store, clock } = useStore();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [firstSyncPending, setFirstSyncPending] = useState(false);
  const [mode, setMode] = useState<AuthMode>("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [resetSent, setResetSent] = useState(false);
  const [failed, setFailed] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const syncing = useRef(false);

  const decideFirstSync = useCallback(async () => {
    const hasLocalCollection = (await store.listCopies()).length > 0;
    const hasSyncedBefore = (await store.readSyncCursor()) > 0;
    return hasLocalCollection && !hasSyncedBefore;
  }, [store]);

  // Restore the session from the keychain. Never blocks the UI: the app is fully usable
  // with no account, so a slow or absent network must not gate anything.
  useEffect(() => {
    void (async () => {
      const token = await refreshSession();
      if (token !== null) {
        try {
          const me = await import("@/api/client").then((m) =>
            m.request<AccountUser>("/api/v1/auth/me"),
          );
          setUser(me);
          setFirstSyncPending(await decideFirstSync());
        } catch {
          setUser(null);
        }
      }
      setProviders(await authProviders());
      setRestoring(false);
    })();
  }, [decideFirstSync]);

  useEffect(() => {
    if (user === null || firstSyncPending) return;

    const engine = new SyncEngine(store, clock);
    const run = async () => {
      // A slow sync must not stack up behind itself on a flaky connection.
      if (syncing.current) return;
      syncing.current = true;
      try {
        await engine.sync();
      } catch {
        // Offline or the server is down. Local changes stay recorded as pending, so the
        // next tick picks them up; nothing is lost.
      } finally {
        syncing.current = false;
      }
    };

    void run();
    const timer = setInterval(() => void run(), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, firstSyncPending, store, clock]);

  const submit = useCallback(async () => {
    setBusy(true);
    setFailed(null);
    try {
      const account =
        mode === "REGISTER"
          ? await createAccount(email.trim(), password, displayName.trim())
          : await signIn(email.trim(), password, rememberMe);
      setUser(account);
      setFirstSyncPending(await decideFirstSync());
      setPassword("");
    } catch (error) {
      const status = (error as { status?: number }).status;
      setFailed(status === 409 ? "emailTaken" : status === 401 ? "badCredentials" : "generic");
    } finally {
      setBusy(false);
    }
  }, [mode, email, password, displayName, rememberMe, decideFirstSync]);

  const forgotPassword = useCallback(async () => {
    setBusy(true);
    await requestPasswordReset(email.trim());
    setResetSent(true);
    setBusy(false);
  }, [email]);

  const resolveFirstSync = useCallback(
    async (strategy: FirstSyncStrategy) => {
      setBusy(true);
      try {
        await new SyncEngine(store, clock).firstSync(strategy);
        setFirstSyncPending(false);
      } finally {
        setBusy(false);
      }
    },
    [store, clock],
  );

  const leave = useCallback(async () => {
    setBusy(true);
    await signOut();
    setUser(null);
    setFirstSyncPending(false);
    setBusy(false);
    // The local collection deliberately stays: signing out returns the app to how it
    // behaves with no account, and wiping someone's records would be a way to lose data.
  }, []);

  return {
    user,
    restoring,
    firstSyncPending,
    mode,
    setMode: useCallback((next: AuthMode) => {
      setMode(next);
      setFailed(null);
    }, []),
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    rememberMe,
    setRememberMe,
    agreed,
    setAgreed,
    providers,
    resetSent,
    forgotPassword,
    // Completeness only, except the terms box: that is a required acknowledgement rather
    // than a format rule, so it does gate the button.
    canSubmit:
      email.trim().length > 0 && password.length > 0 && (mode === "SIGN_IN" || agreed),
    submit,
    busy,
    failed,
    resolveFirstSync,
    signOut: leave,
  };
}
