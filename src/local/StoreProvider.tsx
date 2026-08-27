import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { ClockSource } from "@janne6565/rekordo-shared";
import { hlcDecode, hlcEncode, hlcInitial, hlcTick } from "@janne6565/rekordo-shared";
import type { NativeLocalStore } from "@/local/LocalStore";
import { SqliteLocalStore } from "@/local/sqliteStore";

interface StoreContextValue {
  readonly store: NativeLocalStore;
  readonly clock: ClockSource;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Opens the local database and restores the device clock before rendering.
 *
 * The clock is loaded from disk rather than started fresh: an HLC that resets on every
 * launch would hand out stamps behind ones it has already issued, and those edits would
 * silently lose every future merge.
 */
export function StoreProvider({ children }: { readonly children: ReactNode }) {
  const [value, setValue] = useState<StoreContextValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const store = new SqliteLocalStore();
      await store.open();
      const node = await store.deviceId();
      const persisted = await store.readClock();
      let current = persisted === undefined ? hlcInitial(node) : hlcDecode(persisted);

      const clock: ClockSource = {
        next() {
          current = hlcTick(current, Date.now());
          void store.writeClock(hlcEncode(current));
          return current;
        },
      };

      if (!cancelled) setValue({ store, clock });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (value === null) return null;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext);
  if (value === null) {
    throw new Error("useStore must be used inside a StoreProvider");
  }
  return value;
}
