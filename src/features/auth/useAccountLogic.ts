import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AccountUser,
  type AuthProvider,
  authProviders,
  createAccount,
  deleteAccount,
  requestPasswordReset,
  signIn,
  signOut,
} from "@/api/auth";
import { refreshSession } from "@/api/client";
import { toCsv } from "@/domain/csv";
import { useStore } from "@/local/StoreProvider";
import { readLastSyncedAt, readSyncEnabled, writeLastSyncedAt, writeSyncEnabled } from "@/local/settings";
import { createSyncEngine } from "@/sync/transport";
import type { FirstSyncStrategy } from "@janne6565/music-collector-shared";

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
  const [syncEnabled, setSyncEnabledState] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
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
      setSyncEnabledState(await readSyncEnabled(store));
      setLastSyncedAt(await readLastSyncedAt(store));
      setRestoring(false);
    })();
  }, [decideFirstSync, store]);

  useEffect(() => {
    if (user === null || firstSyncPending) return;

    const engine = createSyncEngine(store, clock);
    const run = async () => {
      // A slow sync must not stack up behind itself on a flaky connection.
      if (syncing.current) return;
      // Read every tick rather than once: the account screen can switch this off while the
      // interval is already running, and it should take effect on the next tick.
      if (!(await readSyncEnabled(store))) return;
      syncing.current = true;
      try {
        await engine.sync();
        const at = Date.now();
        await writeLastSyncedAt(store, at);
        setLastSyncedAt(at);
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
        await createSyncEngine(store, clock).firstSync(strategy);
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

  /**
   * The collection as a file. Built on the device from the local store, so it works
   * offline and works identically with no account at all.
   */
  const exportCsv = useCallback(async () => {
    const copies = await store.listCopies();
    const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
    const file = `${FileSystem.cacheDirectory}music-collector-${new Date().toISOString().slice(0, 10)}.csv`;
    await FileSystem.writeAsStringAsync(file, toCsv(copies, releases));
    // The share sheet is the only way to get a file off a phone: there is no download
    // folder to write to and no browser to hand it to.
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    }
  }, [store]);

  const removeAccount = useCallback(async () => {
    setBusy(true);
    try {
      await deleteAccount();
      setUser(null);
      setFirstSyncPending(false);
      // The cursor points into a change log that no longer exists; leaving it would make a
      // later sign-in believe it had already pulled everything.
      await store.writeSyncCursor(0);
    } finally {
      setBusy(false);
    }
  }, [store]);

  return {
    user,
    restoring,
    syncEnabled,
    setSyncEnabled: useCallback(
      async (enabled: boolean) => {
        setSyncEnabledState(enabled);
        await writeSyncEnabled(store, enabled);
      },
      [store],
    ),
    lastSyncedAt,
    exportCsv,
    deleteAccount: removeAccount,
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
