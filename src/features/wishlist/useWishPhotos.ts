import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/local/StoreProvider";

/**
 * The picture somebody gave a hand-entered wish, as a file URI an Image can render.
 *
 * A wish for a record no catalogue has can get a cover no other way — nothing will ever
 * resolve artwork for an album nobody holds — so this is the whole of that half of the
 * list. Cheap here, as on the shelf: the bytes are already files, so it is one query and
 * no reading.
 *
 * A picture uploaded on another device has a row before it has a file; the URI is handed
 * over anyway and `ReleaseArt` falls through to the silhouette until the bytes arrive.
 *
 * Mirrored from rekordo-frontend/src/features/wishlist/useWishPhotos.ts, which
 * has to build object URLs from IndexedDB blobs instead.
 */
export function useWishPhotos(wishIds: readonly string[]): ReadonlyMap<string, string> {
  const { store } = useStore();

  const photos = useQuery({
    // Joined, so the key changes only when the set of entries on screen does.
    queryKey: ["wish-photos", wishIds.join(",")],
    queryFn: async () => {
      const covers = await store.listWishPhotos(wishIds);
      return new Map([...covers].map(([wishId, photo]) => [wishId, store.photoUri(photo.id)]));
    },
  });

  return photos.data ?? EMPTY;
}

const EMPTY: ReadonlyMap<string, string> = new Map();
