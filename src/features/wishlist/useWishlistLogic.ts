import { lookupAlbumCovers, lookupPressingCovers } from "@/api/releases";
import { useWishPhotos } from "@/features/wishlist/useWishPhotos";
import { useStore } from "@/local/StoreProvider";
import { readWishlistSort, writeWishlistSort } from "@/local/settings";
import type { WishPatch, WishSort, WishlistItem } from "@janne6565/music-collector-shared";
import {
  applyWishPatch,
  hasManualOrder,
  isManualReleaseId,
  manualOrderWrites,
  moveWish,
  sortWishlist,
  tombstonePhoto,
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

  /**
   * The albums on the list, sorted and de-duplicated so the query key is the *set* rather
   * than the order it happens to be shown in — reordering a list must not refetch it.
   */
  const albumIds = useMemo(
    () =>
      [...new Set(items.map((item) => item.albumId))]
        .filter((albumId) => !isManualReleaseId(albumId))
        .sort(),
    [items],
  );

  /**
   * The artwork, which an entry does not carry.
   *
   * A wish is for an album, and an album is an id and a title — the cover belongs to a
   * pressing of it, so the server resolves one. Kept out of the local store deliberately:
   * it is a fact about a catalogue that any client may re-ask for, not part of the
   * collection, and a phone offline simply draws the format silhouette instead.
   */
  /**
   * The pictures people uploaded, which any entry may now have.
   *
   * It used to be the hand-entered half of the list only, on the grounds that everything
   * else has a catalogue to ask. It still does — but its answer is one pressing's sleeve
   * among several, and a wish is a note to yourself, so an uploaded picture outranks it.
   */
  const ownPhotos = useWishPhotos(useMemo(() => items.map((item) => item.id), [items]));

  /**
   * The pressings entries were made from, sorted and de-duplicated for the same reason the
   * albums are: the query key is the set, not the order the list happens to be in.
   */
  const releaseIds = useMemo(
    () =>
      [
        ...new Set(
          items
            .map((item) => item.releaseId)
            .filter((releaseId): releaseId is string => releaseId !== null),
        ),
      ]
        .filter((releaseId) => !isManualReleaseId(releaseId))
        .sort(),
    [items],
  );

  const pressingCovers = useQuery({
    queryKey: ["pressingCovers", releaseIds],
    enabled: releaseIds.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupPressingCovers(releaseIds),
  });

  const covers = useQuery({
    queryKey: ["albumCovers", albumIds],
    enabled: albumIds.length > 0,
    // The mirror's answer for an album does not move while a list is open.
    staleTime: 60 * 60 * 1000,
    queryFn: () => lookupAlbumCovers(albumIds, store),
  });

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
    mutationFn: async (item: WishlistItem) => {
      const now = Date.now();
      await store.putWishlistItem(tombstoneWishlistItem(item, clock, now));
      // The picture goes with it. A wish id is never reused, so a photo left behind is one
      // nothing can ever reference again — and the server only deletes the object in
      // storage when the record it belongs to is put down.
      const picture = (await store.listWishPhotos([item.id])).get(item.id);
      if (picture !== undefined) await store.putPhoto(tombstonePhoto(picture, clock, now));
    },
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["wish-photos"] });
    },
  });

  return {
    items: ordered,
    count: items.length,
    loading: wishlist.isLoading,
    sort,
    manual: hasManualOrder(items),
    /**
     * The catalogue's artwork: the sleeve of the pressing this entry was made from, and the
     * album's only when there is no pressing or the mirror has never seen it.
     */
    coverOf: (item: WishlistItem): string | null => {
      const pressing =
        item.releaseId === null ? undefined : pressingCovers.data?.get(item.releaseId);
      return pressing ?? covers.data?.get(item.albumId) ?? null;
    },
    /**
     * The picture somebody uploaded for this entry.
     *
     * Kept apart from the catalogue's cover rather than folded into it: this one is a file
     * on the device, so it paints on the frame it is asked for, and the sweep that says
     * "on its way" belongs to artwork that genuinely is.
     */
    pictureOf: (item: WishlistItem): string | null => ownPhotos.get(item.id) ?? null,
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
