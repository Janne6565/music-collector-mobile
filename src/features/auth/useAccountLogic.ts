import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { signInWithProvider } from "@/features/auth/externalSignIn";
import { toCsv, wishlistToCsv } from "@/domain/csv";
import { lookupAlbumCovers, lookupPressingCovers } from "@/api/releases";
import { readPhotoBytes } from "@/local/photoBytes";
import { encodeBase64 } from "@/local/sqliteStore";
import { useStore } from "@/local/StoreProvider";
import {
  readLastSyncedAt,
  readSyncEnabled,
  writeCatalogueGap,
  writeLastSyncedAt,
  writeSyncEnabled,
} from "@/local/settings";
import { firstSyncResolved, renamed, signedIn, signedOut } from "@/store/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createSyncEngine } from "@/sync/transport";
import type { FirstSyncStrategy } from "@janne6565/music-collector-shared";
import { MC_MIME_TYPE, exportMcArchive, mcFileName, passwordLongEnough } from "@janne6565/music-collector-shared";

export type AuthMode = "SIGN_IN" | "REGISTER";
export type AuthError =
  | "badCredentials"
  | "emailTaken"
  | "invalidEmail"
  | "passwordTooShort"
  | "consentRequired"
  | "generic";

/**
 * Which input a field the server refused belongs to.
 *
 * The server answers a rejected body with the field names it would not take, and the
 * sentence for each is looked up here so it arrives in the reader's language. A field this
 * form does not have falls back to the generic line rather than being invented a message.
 */
const FIELD_ERRORS: Readonly<Record<string, AuthError>> = {
  email: "invalidEmail",
  password: "passwordTooShort",
  acceptedTerms: "consentRequired",
  confirmedAge: "consentRequired",
};

function errorsFrom(error: unknown): AuthError[] {
  const { status, invalidFields } = error as { status?: number; invalidFields?: readonly string[] };
  if (status === 409) return ["emailTaken"];
  if (status === 401) return ["badCredentials"];
  // One line per distinct complaint: both consent ticks map to the same sentence, and
  // printing it twice would read as two different problems.
  const named = [
    ...new Set(
      (invalidFields ?? [])
        .map((field) => FIELD_ERRORS[field])
        .filter((mapped): mapped is AuthError => mapped !== undefined),
    ),
  ];
  return named.length > 0 ? named : ["generic"];
}

/** Reconcile with the server this often while the app is open and signed in. */
const SYNC_INTERVAL_MS = 60_000;

export function useAccountLogic() {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  /*
   * The session is read from the store rather than held here, because this hook is mounted
   * three times (the account screen, Your data, the legal index) and the Friends tab needs
   * the same answer without mounting it at all. Restoring it is <RestoreSession />'s job.
   */
  const user = useAppSelector((state) => state.auth.user);
  const restoring = useAppSelector((state) => state.auth.status === "unknown");
  const firstSyncPending = useAppSelector((state) => state.auth.firstSyncPending);
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
  const [failed, setFailed] = useState<readonly AuthError[]>([]);
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

  // Only the things this screen owns. The session itself is restored once at the root.
  useEffect(() => {
    void (async () => {
      setProviders(await authProviders());
      setSyncEnabledState(await readSyncEnabled(store));
      setLastSyncedAt(await readLastSyncedAt(store));
    })();
  }, [store]);

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
        const result = await engine.sync();
        // Recorded before the screens are told to refetch, so the shelf reads this pass's
        // answer rather than the one before it.
        await writeCatalogueGap(store, {
          missing: result.releasesMissing,
          unreachable: result.releasesUnreachable,
        });
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
    // The one rule worth checking before the round trip, because the server can only
    // answer it with the same sentence the field already carries as a hint.
    if (mode === "REGISTER" && !passwordLongEnough(password)) {
      setFailed(["passwordTooShort"]);
      return;
    }
    setBusy(true);
    setFailed([]);
    try {
      const account =
        mode === "REGISTER"
          ? await createAccount(email.trim(), password, displayName.trim(), agreed, ageConfirmed)
          : await signIn(email.trim(), password, rememberMe);
      dispatch(signedIn({ user: account, firstSyncPending: await decideFirstSync() }));
      setPassword("");
    } catch (error) {
      setFailed(errorsFrom(error));
    } finally {
      setBusy(false);
    }
  }, [mode, email, password, displayName, rememberMe, decideFirstSync, dispatch]);

  /**
   * Google or Apple. Ends in the same place a password sign-in does — the round trip
   * through the browser is an implementation detail of proving who somebody is.
   */
  const signInWith = useCallback(
    async (providerId: string) => {
      setBusy(true);
      setFailed([]);
      try {
        const result = await signInWithProvider(providerId);
        // Closing the browser is a decision, not a failure; saying "something went wrong"
        // about it would be telling somebody their own choice was a mistake.
        if (result.outcome === "CANCELLED") return;
        if (result.outcome === "FAILED") {
          setFailed(["generic"]);
          return;
        }
        dispatch(signedIn({ user: result.user, firstSyncPending: await decideFirstSync() }));
      } finally {
        setBusy(false);
      }
    },
    [decideFirstSync, dispatch],
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
        dispatch(firstSyncResolved());
      } finally {
        setBusy(false);
      }
    },
    [store, clock, queryClient, dispatch],
  );

  const leave = useCallback(async () => {
    setBusy(true);
    await signOut();
    dispatch(signedOut());
    setBusy(false);
    // The local collection deliberately stays: signing out returns the app to how it
    // behaves with no account, and wiping someone's records would be a way to lose data.
  }, [dispatch]);

  /**
   * Hands a finished CSV to the share sheet, which is the only way to get a file off a
   * phone: there is no download folder to write to and no browser to hand it to.
   */
  const shareCsv = useCallback(async (name: string, text: string) => {
    const file = `${FileSystem.cacheDirectory}${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    await FileSystem.writeAsStringAsync(file, text);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    }
  }, []);

  /**
   * The collection as a file. Built on the device from the local store, so it works
   * offline and works identically with no account at all.
   */
  const exportCsv = useCallback(async () => {
    const copies = await store.listCopies();
    const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
    await shareCsv("music-collector", toCsv(copies, releases));
  }, [store, shareCsv]);

  /**
   * The wishlist as its own file, for the same reason it is its own screen: it is a list of
   * records you do not have, and folding it into the collection export would put a row in
   * the spreadsheet for something that is not on the shelf.
   */
  const exportWishlistCsv = useCallback(async () => {
    await shareCsv("music-collector-wishlist", wishlistToCsv(await store.listWishlist()));
  }, [store, shareCsv]);

  /**
   * The whole shelf in one file, photographs included.
   *
   * The two CSVs above are for reading; this one is for keeping. A spreadsheet has no
   * column that can hold a photograph, and none that can hold the clocks that make a copy
   * recognisable as *the same copy* when it comes back. The archive carries both, and the
   * two CSVs with them, so the file is still readable by anything years from now.
   *
   * Written as base64 because that is the only way to put bytes into a file from
   * JavaScript here — expo-file-system takes a string either way.
   */
  const exportArchive = useCallback(async () => {
    const exportedAt = new Date();
    const copies = await store.listCopies();
    const wishlist = await store.listWishlist();
    const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
    const archive = await exportMcArchive(
      store,
      { collection: toCsv(copies, releases), wishlist: wishlistToCsv(wishlist) },
      (photoId) => readPhotoBytes(store, photoId),
      exportedAt,
      // The one request an export makes: a wish's cover lives in this deployment's release
      // mirror rather than in the collection, and an archive that did not ask would lose
      // the wishlist's pictures the moment it was imported against a different mirror.
      (albumIds) => lookupAlbumCovers(albumIds),
      // And the sleeves of the pressings those entries were made from: the covers endpoint
      // is asked about albums, and an album cannot say which of its pressings was picked.
      (releaseIds) => lookupPressingCovers(releaseIds),
    );
    const file = `${FileSystem.cacheDirectory}${mcFileName(exportedAt)}`;
    await FileSystem.writeAsStringAsync(file, encodeBase64(archive.bytes.slice().buffer as ArrayBuffer), {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file, { mimeType: MC_MIME_TYPE, UTI: "public.zip-archive" });
    }
    return archive;
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
      dispatch(signedOut());
      // The cursor points into a change log that no longer exists; leaving it would make a
      // later sign-in believe it had already pulled everything.
      await store.writeSyncCursor(0);
    } finally {
      setBusy(false);
    }
  }, [store, dispatch]);

  const accountName = user?.displayName ?? "";
  const saveName = useCallback(async () => {
    const next = nameDraft;
    if (next === null || next.trim() === accountName) return;
    setRenaming(true);
    setRenameFailed(false);
    try {
      dispatch(renamed(await updateDisplayName(next.trim())));
      // Back to following the account, which now says what was just typed.
      setNameDraft(null);
    } catch {
      setRenameFailed(true);
    } finally {
      setRenaming(false);
    }
  }, [nameDraft, accountName, dispatch]);

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
    exportWishlistCsv,
    exportArchive,
    exportJson,
    deleteAccount: removeAccount,
    firstSyncPending,
    mode,
    setMode: useCallback((next: AuthMode) => {
      setMode(next);
      setFailed([]);
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
