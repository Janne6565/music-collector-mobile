import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { searchReleases } from "@/api/releases";
import type { WishlistItem } from "@janne6565/music-collector-shared";
import { createCopy, tombstoneWishlistItem } from "@janne6565/music-collector-shared";
import { useStore } from "@/local/StoreProvider";
import * as Crypto from "expo-crypto";

export function useWishlistLogic() {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();

  const wishlist = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => store.listWishlist(),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    await queryClient.invalidateQueries({ queryKey: ["copies"] });
    await queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  /**
   * "Got it" — the whole point of a wishlist.
   *
   * Looks the album up so the new copy points at a real release rather than a placeholder,
   * and only removes the wish once the copy exists: losing the wish and gaining nothing
   * would be the worse of the two failures.
   */
  const collect = useMutation({
    mutationFn: async (item: WishlistItem) => {
      const query = `artist:"${item.artistName}" AND release:"${item.title}"`;
      const candidates = await searchReleases(query, 10).catch(() => []);
      const release =
        candidates.find((candidate) => candidate.format === item.desiredFormat) ?? candidates[0];
      if (release === undefined) {
        throw new Error("No matching release found");
      }

      await store.cacheReleases([release]);
      await store.putCopy(
        createCopy(
          release,
          {
            condition: null,
            sleeveCondition: null,
            preferCatalogArt: false,
            pricePaidCents: null,
            currency: "EUR",
            purchasedOn: null,
            purchasedAt: null,
            // The wish note becomes the copy's note: "want an original Spoon press" is
            // exactly the sort of thing you still want written down once you own it.
            notes: item.note,
            rating: null,
          },
          clock,
          Date.now(),
          Crypto.randomUUID(),
        ),
      );
      await store.putWishlistItem(tombstoneWishlistItem(item, clock, Date.now()));
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (item: WishlistItem) => {
      await store.putWishlistItem(tombstoneWishlistItem(item, clock, Date.now()));
    },
    onSuccess: invalidate,
  });

  return {
    items: wishlist.data ?? [],
    loading: wishlist.isLoading,
    collect: (item: WishlistItem) => collect.mutate(item),
    collecting: collect.isPending ? collect.variables?.id : undefined,
    collectFailed: collect.isError,
    remove: (item: WishlistItem) => remove.mutate(item),
    removing: remove.isPending ? remove.variables?.id : undefined,
  };
}
