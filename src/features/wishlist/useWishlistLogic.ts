import { useStore } from "@/local/StoreProvider";
import { readWishlistSort, writeWishlistSort } from "@/local/settings";
import type { WishPatch, WishSort, WishlistItem } from "@janne6565/music-collector-shared";
import {
  applyWishPatch,
  hasManualOrder,
  manualOrderWrites,
  moveWish,
  sortWishlist,
  tombstoneWishlistItem,
} from "@janne6565/music-collector-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Screens 16a and 16b — the list, and what an entry can be told to do.
 *
 * Deliberately the same shape as the web hook of this name, down to the field names: the
 * two screens are drawn differently but they are one feature, and a phone that decides
 * "found it" means something else is a phone that empties the list wrongly.
 */
export function useWishlistLogic() {
  const { store, clock } = useStore();
  const queryClient = useQueryClient();

  const wishlist = useQuery({ queryKey: ["wishlist"], queryFn: () => store.listWishlist() });
  const sortQuery = useQuery({
    queryKey: ["wishlistSort"],
    queryFn: () => readWishlistSort(store),
  });

  const sort: WishSort = sortQuery.data ?? "NEWEST";
  const items = wishlist.data ?? [];
  const ordered = useMemo(() => sortWishlist(items, sort), [items, sort]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["wishlist"] });

  const chooseSort = useMutation({
    mutationFn: (next: WishSort) => writeWishlistSort(store, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlistSort"] }),
  });

  /**
   * Dropping a row renumbers the list and switches the sort to "Your order".
   *
   * Switching is the point, not a side effect: dragging while the list is ordered by title
   * would otherwise produce a move the next render undoes.
   */
  const reorder = useMutation({
    mutationFn: async ({ from, to }: { readonly from: number; readonly to: number }) => {
      const next = moveWish(ordered, from, to);
      for (const { item, sortIndex } of manualOrderWrites(next)) {
        await store.putWishlistItem(applyWishPatch(item, { sortIndex }, clock));
      }
      await writeWishlistSort(store, "MANUAL");
    },
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["wishlistSort"] });
    },
  });

  const edit = useMutation({
    mutationFn: ({ item, patch }: { readonly item: WishlistItem; readonly patch: WishPatch }) =>
      store.putWishlistItem(applyWishPatch(item, patch, clock)),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (item: WishlistItem) =>
      store.putWishlistItem(tombstoneWishlistItem(item, clock, Date.now())),
    onSuccess: invalidate,
  });

  return {
    items: ordered,
    count: items.length,
    loading: wishlist.isLoading,
    sort,
    manual: hasManualOrder(items),
    setSort: (next: WishSort) => chooseSort.mutate(next),
    reorder: (from: number, to: number) => reorder.mutate({ from, to }),
    edit: (item: WishlistItem, patch: WishPatch) => edit.mutate({ item, patch }),
    remove: (item: WishlistItem) => remove.mutate(item),
    removing: remove.isPending ? remove.variables?.id : undefined,
  };
}

/** One entry, for screen 16b. Reads the same store rather than being handed down a list. */
export function useWishEntryLogic(wishId: string) {
  const { store } = useStore();
  const logic = useWishlistLogic();

  const entry = useQuery({
    queryKey: ["wishlist", wishId],
    queryFn: async () =>
      (await store.listWishlist()).find((item) => item.id === wishId) ?? null,
  });

  /**
   * The other records by this artist you already own (16b's footer).
   *
   * Matched on the artist name rather than an artist id: a wish carries the name it was
   * created with and nothing else, and a footnote is not worth a lookup that can fail.
   */
  const alsoOwned = useQuery({
    queryKey: ["wishlistAlsoOwned", wishId],
    enabled: entry.data != null,
    queryFn: async () => {
      const artist = entry.data?.artistName.toLowerCase();
      if (artist === undefined) return [];
      const copies = await store.listCopies();
      const releases = await store.getReleases(copies.map((copy) => copy.releaseId));
      return copies
        .map((copy) => releases.get(copy.releaseId))
        .filter((release) => release !== undefined)
        .filter((release) => release.artistName.toLowerCase() === artist)
        .map((release) => release.title);
    },
  });

  return {
    ...logic,
    entry: entry.data ?? null,
    loading: entry.isLoading,
    alsoOwned: [...new Set(alsoOwned.data ?? [])],
  };
}
