import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { useStore } from "@/local/StoreProvider";
import { readSyncEnabled, writeCatalogueGap, writeLastSyncedAt } from "@/local/settings";
import { useAppSelector } from "@/store/hooks";
import { createSyncEngine } from "@/sync/transport";

/** A minute between passes: often enough to feel live, rare enough to spare the battery. */
const SYNC_INTERVAL_MS = 60_000;

interface SyncControls {
  /**
   * Run a pass now, and resolve when it is done.
   *
   * What a pull-to-refresh calls. Refetching the screen's queries is not the same thing:
   * every screen reads the local store, so re-reading it can only ever show what the last
   * sync already wrote.
   */
  readonly syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncControls | null>(null);

/**
 * The sync loop, above the tabs.
 *
 * It used to live in `useAccountLogic`, which is mounted by the account screen, Your data
 * and the legal index -- and by nothing else. A tab is not mounted until it is opened, so
 * on a cold launch straight into the shelf there was no loop at all: the collection sat
 * there undescribed, and the only way to start a sync was to visit the You tab. Signing in
 * happens on that tab, which is why this only ever showed up on the *second* launch.
 *
 * Mounted beside <RestoreSession /> for the same reason it is: what the whole app depends
 * on cannot hang off whichever screen happens to be on top.
 */
export function SyncProvider({ children }: { readonly children: ReactNode }) {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);
  const firstSyncPending = useAppSelector((state) => state.auth.firstSyncPending);
  const running = useRef(false);

  const runSync = useCallback(async () => {
    if (user === null || firstSyncPending) return;
    // A slow sync must not stack up behind itself on a flaky connection, and a pull-to-
    // refresh landing mid-tick must not start a second one.
    if (running.current) return;
    // Read every time rather than once: the account screen can switch this off while the
    // interval is already running, and it should take effect on the next pass.
    if (!(await readSyncEnabled(store))) return;
    running.current = true;
    try {
      const result = await createSyncEngine(store, clock).sync();
      // Recorded before the screens are told to refetch, so the shelf reads this pass's
      // answer rather than the one before it.
      await writeCatalogueGap(store, {
        missing: result.releasesMissing,
        unreachable: result.releasesUnreachable,
      });
      await writeLastSyncedAt(store, Date.now());
      // Every screen reads the local store through a query, and a sync writes to that
      // store behind their backs. Without this the shelf keeps the empty result it
      // fetched before the first sync landed: the tabs stay mounted, so nothing remounts
      // and React Native has no window focus to refetch on. Signing in on a new device
      // looked like the sync had pulled nothing at all.
      await queryClient.invalidateQueries();
    } catch {
      // Offline or the server is down. Local changes stay recorded as pending, so the
      // next pass picks them up; nothing is lost.
    } finally {
      running.current = false;
    }
  }, [user, firstSyncPending, store, clock, queryClient]);

  useEffect(() => {
    if (user === null || firstSyncPending) return;
    void runSync();
    const timer = setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, firstSyncPending, runSync]);

  return <SyncContext.Provider value={{ syncNow: runSync }}>{children}</SyncContext.Provider>;
}

/** No-ops without a provider, so a screen rendered in isolation still works. */
export function useSync(): SyncControls {
  return useContext(SyncContext) ?? { syncNow: async () => undefined };
}
