import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AccountUser,
  type AuthProvider,
  accountExport,
  authProviders,
  createAccount,
  deleteAccount,
  requestPasswordReset,
  signIn,
  signOut,
  updateDisplayName,
} from "@/api/auth";
import { refreshSession } from "@/api/client";
import { signInWithProvider } from "@/features/auth/externalSignIn";
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [firstSyncPending, setFirstSyncPending] = useState(false);
  const [mode, setMode] = useState<AuthMode>("SIGN_IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  /**
   * Two ticks, neither pre-checked (screen 17a).
   *
   * Separate booleans because they are two statements: agreeing to the terms is a contract,
   * confirming an age is a declaration of fact, and one box covering both would let somebody
   * agree to one by accepting the other.
   */
  const [agreed, setAgreed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [resetSent, setResetSent] = useState(false);
  const [failed, setFailed] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The name in the field, or null while it is still just showing the account's own.
   *
   * Null rather than a copy of the current name, because the session is restored from the
   * keychain after this screen has mounted: a draft seeded up front would sit there empty
   * until the person touched it.
   */
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameFailed, setRenameFailed] = useState(false);
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
        // Every screen reads the local store through a query, and a sync writes to that
        // store behind their backs. Without this the shelf keeps the empty result it
        // fetched before the first sync landed: the tabs stay mounted, so nothing remounts
        // and React Native has no window focus to refetch on. Signing in on a new device
        // looked like the sync had pulled nothing at all.
        await queryClient.invalidateQueries();
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
  }, [user, firstSyncPending, store, clock, queryClient]);

  const submit = useCallback(async () => {
    setBusy(true);
    setFailed(null);
    try {
      const account =
        mode === "REGISTER"
          ? await createAccount(email.trim(), password, displayName.trim(), agreed, ageConfirmed)
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

  /**
   * Google or Apple. Ends in the same place a password sign-in does — the round trip
   * through the browser is an implementation detail of proving who somebody is.
   */
  const signInWith = useCallback(
    async (providerId: string) => {
      setBusy(true);
      setFailed(null);
      try {
        const result = await signInWithProvider(providerId);
        // Closing the browser is a decision, not a failure; saying "something went wrong"
        // about it would be telling somebody their own choice was a mistake.
        if (result.outcome === "CANCELLED") return;
        if (result.outcome === "FAILED") {
          setFailed("generic");
          return;
        }
        setUser(result.user);
        setFirstSyncPending(await decideFirstSync());
      } finally {
        setBusy(false);
      }
    },
    [decideFirstSync],
  );

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
        // The same reason as the interval sync: whichever way the first one resolved, the
        // store underneath every screen has just changed.
        await queryClient.invalidateQueries();
        setFirstSyncPending(false);
      } finally {
        setBusy(false);
      }
    },
    [store, clock, queryClient],
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

  /**
   * The whole record as JSON: the server's copy when there is an account, the device's own
   * store when there is not. A "download my data" that quietly returned an empty file to
   * somebody with no account would be the wrong kind of correct.
   */
  const exportJson = useCallback(async () => {
    const body = user === null ? await localExport() : await accountExport();
    const file = `${FileSystem.cacheDirectory}music-collector-export-${new Date().toISOString().slice(0, 10)}.json`;
    await FileSystem.writeAsStringAsync(file, JSON.stringify(body, null, 2));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file, { mimeType: "application/json", UTI: "public.json" });
    }
  }, [store, user]);

  /** What a device with no account has to hand over: its own store, and nothing else. */
  async function localExport() {
    const copies = await store.listCopies();
    const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
    return {
      exportedAt: new Date().toISOString(),
      account: null,
      copies,
      releases: [...releases.values()],
      wishes: await store.listWishlist(),
    };
  }

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

  const accountName = user?.displayName ?? "";
  const saveName = useCallback(async () => {
    const next = nameDraft;
    if (next === null || next.trim() === accountName) return;
    setRenaming(true);
    setRenameFailed(false);
    try {
      setUser(await updateDisplayName(next.trim()));
      // Back to following the account, which now says what was just typed.
      setNameDraft(null);
    } catch {
      setRenameFailed(true);
    } finally {
      setRenaming(false);
    }
  }, [nameDraft, accountName]);

  return {
    user,
    restoring,
    /** What the name field shows, which is the account's own name until it is edited. */
    nameDraft: nameDraft ?? accountName,
    editName: useCallback((next: string) => {
      setNameDraft(next);
      setRenameFailed(false);
    }, []),
    /** A rename is only offered once it would actually change something. */
    nameChanged: nameDraft !== null && nameDraft.trim() !== accountName,
    saveName,
    renaming,
    renameFailed,
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
    exportJson,
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
    ageConfirmed,
    setAgeConfirmed,
    setAgreed,
    providers,
    signInWith,
    resetSent,
    forgotPassword,
    // Completeness only, except the terms box: that is a required acknowledgement rather
    // than a format rule, so it does gate the button.
    canSubmit:
      email.trim().length > 0 &&
      password.length > 0 &&
      (mode === "SIGN_IN" || (agreed && ageConfirmed)),
    submit,
    busy,
    failed,
    resolveFirstSync,
    signOut: leave,
  };
}
