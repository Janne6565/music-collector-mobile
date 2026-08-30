import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { lookupByBarcode } from "@/api/releases";
import { useStore } from "@/local/StoreProvider";
import { resolvePendingScans } from "@janne6565/rekordo-shared";

/**
 * How often the scans that could not be looked up are asked about again.
 *
 * Slow on purpose. The thing being waited for is a connection, and a phone that has one
 * resolves on the very next tick; a phone that does not gains nothing from being asked
 * every thirty seconds in a basement. Coming back to the foreground is the signal that
 * actually correlates with having signal again, and that is handled separately.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Naming the offline scans, on its own loop rather than inside sync.
 *
 * Sync needs an account; this does not. The app is local-first — somebody can scan a whole
 * crate in a shop having never signed in — so tying the lookup to sync would leave exactly
 * those people with a shelf of bare barcodes forever.
 *
 * Mounted once, above the tabs, for the reason the sync loop is: a tab that is only
 * created when it is first opened is a tab that never ran anything on a cold launch.
 */
export function usePendingScans(): void {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  /**
   * Barcodes the catalogues have already answered "nothing" for.
   *
   * A ref, so it lives as long as the app does and no longer: a promo the mirror has never
   * heard of should not be asked about every five minutes for the life of the copy, and it
   * should be asked again on the next launch, when the mirror may well have it.
   */
  const asked = useRef(new Set<string>());
  const running = useRef(false);

  useEffect(() => {
    const sweep = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const result = await resolvePendingScans({
          store,
          clock,
          lookup: lookupByBarcode,
          asked: asked.current,
        });
        // Only when something actually changed: the sweep runs on a timer, and refetching
        // every screen every five minutes to learn that nothing moved is pure churn.
        if (result.copies > 0 || result.wishes > 0) {
          await queryClient.invalidateQueries();
        }
      } finally {
        running.current = false;
      }
    };

    void sweep();
    const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
    // Coming back from the lock screen is the moment a phone most often has signal it did
    // not have when it was put away, which is exactly what these scans are waiting for.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sweep();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [store, clock, queryClient]);
}
