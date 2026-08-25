import { useUndo } from "@/features/wishlist/UndoBar";
import { useStore } from "@/local/StoreProvider";
import type { Copy, Release } from "@janne6565/music-collector-shared";
import { tombstoneWishlistItem, wishSatisfiedBy } from "@janne6565/music-collector-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Screen 16e, on the phone — the entry leaves when the record arrives.
 *
 * The same rule as the web's hook of this name, reading the same `wishSatisfiedBy`: which
 * entry a new copy settles is a decision the two clients must not make differently, or the
 * next sync has one device putting back what the other took off.
 */
export function useSatisfyWishes(): (copy: Copy, release: Release | undefined) => Promise<void> {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();
  const { offer } = useUndo();

  return useCallback(
    async (copy, release) => {
      const satisfied = wishSatisfiedBy(await store.listWishlist(), copy, release);
      if (satisfied === undefined) return;

      await store.putWishlistItem(tombstoneWishlistItem(satisfied, clock, Date.now()));
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      offer({
        wishId: satisfied.id,
        title: satisfied.title,
        wantedSince: satisfied.createdAt,
      });
    },
    [store, clock, queryClient, offer],
  );
}
